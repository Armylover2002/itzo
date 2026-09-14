import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const uri = process.env.MONGO_URI || process.env.MONGODB_URI;

const normalizeSlug = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const buildPathMaps = (docs) => {
  const byId = new Map(docs.map((doc) => [String(doc._id), doc]));
  const pathById = new Map();

  const resolvePath = (doc) => {
    const id = String(doc._id);
    if (pathById.has(id)) return pathById.get(id);

    const parent = doc.parentId ? byId.get(String(doc.parentId)) : null;
    const parentPath = parent ? resolvePath(parent) : [];
    const path = [...parentPath, normalizeSlug(doc.slug || doc.name)];
    pathById.set(id, path);
    return path;
  };

  docs.forEach(resolvePath);
  return pathById;
};

const createQuickCategoryResolver = async (db) => {
  const quickCategories = await db.collection("quick_categories").find({ isActive: true }).toArray();
  if (!quickCategories.length) {
    throw new Error("quick_categories is empty, cannot migrate seller products safely.");
  }

  const quickPaths = buildPathMaps(quickCategories);
  const quickByPath = new Map();

  quickCategories.forEach((doc) => {
    const path = quickPaths.get(String(doc._id)) || [];
    quickByPath.set(path.join("/"), doc);
  });

  const defaultHeader = quickCategories
    .filter((doc) => doc.type === "header")
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))[0];
  const defaultCategory = quickCategories
    .filter((doc) => doc.type === "category" && String(doc.parentId) === String(defaultHeader?._id || ""))
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))[0];
  const defaultSubcategory = quickCategories
    .filter((doc) => doc.type === "subcategory" && String(doc.parentId) === String(defaultCategory?._id || ""))
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))[0];

  return {
    resolveFromSellerPath(pathParts) {
      const fullPath = pathParts.join("/");
      const trimmedPath = pathParts.slice(1).join("/");

      const matchedSubcategory =
        quickByPath.get(fullPath) ||
        quickByPath.get(trimmedPath) ||
        quickCategories.find(
          (doc) =>
            doc.type === "subcategory" &&
            normalizeSlug(doc.slug || doc.name) === pathParts[pathParts.length - 1],
        ) ||
        defaultSubcategory ||
        null;

      const matchedCategory = matchedSubcategory?.parentId
        ? quickCategories.find((doc) => String(doc._id) === String(matchedSubcategory.parentId))
        : defaultCategory || null;

      const matchedHeader = matchedCategory?.parentId
        ? quickCategories.find((doc) => String(doc._id) === String(matchedCategory.parentId))
        : defaultHeader || null;

      return {
        headerId: matchedHeader?._id || null,
        categoryId: matchedCategory?._id || matchedHeader?._id || null,
        subcategoryId: matchedSubcategory?._id || null,
      };
    },
  };
};

const ensureUniqueSlug = async (collection, baseSlug, sellerId, ignoreLegacyId = null) => {
  let slug = normalizeSlug(baseSlug) || "product";
  let attempt = 1;

  while (true) {
    const existing = await collection.findOne({
      slug,
      ...(ignoreLegacyId
        ? { legacySellerProductId: { $ne: ignoreLegacyId } }
        : {}),
    });

    if (!existing) return slug;
    if (String(existing.sellerId || "") === String(sellerId || "")) {
      return slug;
    }

    attempt += 1;
    slug = `${normalizeSlug(baseSlug) || "product"}-${attempt}`;
  }
};

const run = async () => {
  if (!uri) {
    throw new Error("Missing MONGO_URI / MONGODB_URI");
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const sellerCategories = await db.collection("seller_categories").find({}).toArray();
  const sellerProducts = await db.collection("seller_products").find({}).toArray();

  if (!sellerProducts.length) {
    console.log("No legacy seller_products found. Nothing to migrate.");
    await mongoose.disconnect();
    return;
  }

  const sellerPaths = buildPathMaps(sellerCategories);
  const resolveQuickCategory = await createQuickCategoryResolver(db);
  const quickProducts = db.collection("quick_products");

  let inserted = 0;
  let updated = 0;

  for (const legacyProduct of sellerProducts) {
    const existingByLegacyId = await quickProducts.findOne({
      legacySellerProductId: String(legacyProduct._id),
    });

    const sellerPath = legacyProduct.subcategoryId
      ? sellerPaths.get(String(legacyProduct.subcategoryId)) || []
      : legacyProduct.categoryId
        ? sellerPaths.get(String(legacyProduct.categoryId)) || []
        : legacyProduct.headerId
          ? sellerPaths.get(String(legacyProduct.headerId)) || []
          : [];

    const categoryIds = resolveQuickCategory.resolveFromSellerPath(sellerPath);
    const slug = await ensureUniqueSlug(
      quickProducts,
      legacyProduct.slug || legacyProduct.name,
      legacyProduct.sellerId,
      String(legacyProduct._id),
    );

    const nextDoc = {
      name: legacyProduct.name || "Untitled Product",
      slug,
      image: legacyProduct.mainImage || "",
      mainImage: legacyProduct.mainImage || "",
      galleryImages: Array.isArray(legacyProduct.galleryImages) ? legacyProduct.galleryImages : [],
      categoryId: categoryIds.categoryId,
      subcategoryId: categoryIds.subcategoryId,
      headerId: categoryIds.headerId,
      description: legacyProduct.description || "",
      price: Number(legacyProduct.price || 0),
      mrp: Number(
        legacyProduct.mrp ||
          legacyProduct.salePrice ||
          legacyProduct.price ||
          0,
      ),
      unit: legacyProduct.unit || legacyProduct.weight || "",
      weight: legacyProduct.weight || "",
      brand: legacyProduct.brand || "",
      sku: legacyProduct.sku || "",
      stock: Number(legacyProduct.stock || 0),
      lowStockAlert: Number(legacyProduct.lowStockAlert || 5),
      salePrice: Number(legacyProduct.salePrice || 0),
      status: legacyProduct.status === "inactive" ? "inactive" : "active",
      isFeatured: Boolean(legacyProduct.isFeatured),
      tags: Array.isArray(legacyProduct.tags) ? legacyProduct.tags : [],
      variants: Array.isArray(legacyProduct.variants) ? legacyProduct.variants : [],
      deliveryTime: legacyProduct.deliveryTime || "10 mins",
      badge: legacyProduct.badge || "",
      rating: Number(legacyProduct.rating || 4.2),
      isActive: legacyProduct.status === "inactive" ? false : true,
      sellerId: legacyProduct.sellerId || null,
      legacySellerProductId: String(legacyProduct._id),
      legacySellerCategoryPath: sellerPath,
      createdAt: legacyProduct.createdAt || new Date(),
      updatedAt: new Date(),
    };

    if (existingByLegacyId) {
      await quickProducts.updateOne(
        { _id: existingByLegacyId._id },
        { $set: nextDoc },
      );
      updated += 1;
      continue;
    }

    await quickProducts.insertOne({
      ...nextDoc,
      _id: new mongoose.Types.ObjectId(),
    });
    inserted += 1;
  }

  console.log(`Migrated seller products -> quick_products. Inserted: ${inserted}, Updated: ${updated}`);
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(error);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
