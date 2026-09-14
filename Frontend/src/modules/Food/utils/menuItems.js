import { getFoodDisplayPrice, getFoodVariants } from "./foodVariants"

export const getMenuFromResponse = (response) =>
  response?.data?.data?.menu || response?.data?.menu || null

const normalizeItem = (item = {}, sectionName = "", subsectionName = "") => ({
  ...item,
  id: String(item?.id || item?._id || ""),
  sectionName,
  subsectionName,
  image: item?.image || item?.images?.[0] || "",
  name: item?.name || "Unnamed Item",
  category: item?.category || sectionName || "Varieties",
  foodType: item?.foodType || "Non-Veg",
  price: getFoodDisplayPrice(item),
  otherPrice: item?.otherPrice || 0,
  rating: Number(item?.rating || 0),
  reviews: Number(item?.reviews || 0),
  stock: item?.stock || "Unlimited",
  approvalStatus: item?.approvalStatus || "pending",
  isAvailable: item?.isAvailable !== false,
  variants: getFoodVariants(item),
  variations: getFoodVariants(item),
})

export const flattenMenuItems = (menu) => {
  if (!menu || !Array.isArray(menu.sections)) return []

  const items = []
  menu.sections.forEach((section = {}) => {
    const sectionName = section?.name || "Unknown Section"

    ;(section?.items || []).forEach((item = {}) => {
      items.push(normalizeItem(item, sectionName, ""))
    })

    ;(section?.subsections || []).forEach((subsection = {}) => {
      const subsectionName = subsection?.name || "Unknown Subsection"
      ;(subsection?.items || []).forEach((item = {}) => {
        items.push(normalizeItem(item, sectionName, subsectionName))
      })
    })
  })

  return items
}

export const findItemInSections = (sections = [], targetId) => {
  const wantedId = String(targetId || "")
  if (!wantedId || !Array.isArray(sections)) return null

  for (let sIdx = 0; sIdx < sections.length; sIdx += 1) {
    const section = sections[sIdx] || {}
    const sectionItems = Array.isArray(section.items) ? section.items : []

    for (let iIdx = 0; iIdx < sectionItems.length; iIdx += 1) {
      const item = sectionItems[iIdx]
      if (String(item?.id || item?._id || "") === wantedId) {
        return { sectionIndex: sIdx, itemIndex: iIdx, inSubsection: false }
      }
    }

    const subsections = Array.isArray(section.subsections) ? section.subsections : []
    for (let ssIdx = 0; ssIdx < subsections.length; ssIdx += 1) {
      const subsection = subsections[ssIdx] || {}
      const subsectionItems = Array.isArray(subsection.items) ? subsection.items : []
      for (let iIdx = 0; iIdx < subsectionItems.length; iIdx += 1) {
        const item = subsectionItems[iIdx]
        if (String(item?.id || item?._id || "") === wantedId) {
          return {
            sectionIndex: sIdx,
            subsectionIndex: ssIdx,
            itemIndex: iIdx,
            inSubsection: true,
          }
        }
      }
    }
  }

  return null
}
