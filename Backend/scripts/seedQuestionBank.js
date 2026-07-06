import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const questionSchema = new mongoose.Schema({
    questionText: { type: String, required: true, trim: true },
    options: [{ type: String, required: true, trim: true }],
    correctOptionIndex: { type: Number, required: true, min: 0, max: 3 },
    category: { type: String, required: true, trim: true },
    difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], default: 'Medium' },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodAdmin' }
}, { timestamps: true });

const AssessmentQuestion = mongoose.models.AssessmentQuestion || mongoose.model('AssessmentQuestion', questionSchema);

const questionsData = [
    // ── Category 1: Restaurant Onboarding (20 Questions) ──
    {
        questionText: "What is the mandatory Government license required for every food business onboarding onto ITZO Food?",
        options: [
            "Trade License only",
            "14-digit FSSAI Registration or License",
            "ISO 9001 Certification",
            "Fire Safety Clearance Certificate"
        ],
        correctOptionIndex: 1,
        category: "Restaurant Onboarding",
        difficulty: "Easy"
    },
    {
        questionText: "Why is high-resolution, professionally styled food photography critical during menu onboarding?",
        options: [
            "It reduces the app file size",
            "It is required by FSSAI regulations",
            "It increases customer conversion rates by 30%+ and boosts order volume",
            "It allows restaurants to charge double the MRP"
        ],
        correctOptionIndex: 2,
        category: "Restaurant Onboarding",
        difficulty: "Easy"
    },
    {
        questionText: "If a restaurant owner complains about frequent order cancellations, which onboarding setting should you check first?",
        options: [
            "The restaurant's Wi-Fi password",
            "The configured Kitchen Preparation Time and Operating Hours",
            "The color of their packaging boxes",
            "The owner's personal bank account balance"
        ],
        correctOptionIndex: 1,
        category: "Restaurant Onboarding",
        difficulty: "Medium"
    },
    {
        questionText: "What is the primary benefit of pitching an 'Exclusive Partnership' on ITZO Food to a new restaurant?",
        options: [
            "They do not need an FSSAI license",
            "They receive lower platform commission rates, higher search visibility, and co-funded marketing",
            "They can deliver food using their own personal bicycles without tracking",
            "They are exempted from paying GST"
        ],
        correctOptionIndex: 1,
        category: "Restaurant Onboarding",
        difficulty: "Medium"
    },
    {
        questionText: "When onboarding a restaurant that sells gravies, soups, and beverages, what packaging guideline must you strictly emphasize?",
        options: [
            "Using recycled newspaper wrapping",
            "Using 4-ply tamper-evident, spill-proof sealed containers with proper insulation",
            "Leaving lids loosely covered to let steam escape",
            "Packing hot and cold items together in one bag"
        ],
        correctOptionIndex: 1,
        category: "Restaurant Onboarding",
        difficulty: "Medium"
    },
    {
        questionText: "How does dietary tagging (Veg, Non-Veg, Vegan, Jain, Halal) on the ITZO menu impact customer experience?",
        options: [
            "It has no impact on customer searches",
            "It allows customers to filter accurately, building trust and preventing severe dietary or religious violations",
            "It increases the tax rate on the food items",
            "It is only useful for international tourists"
        ],
        correctOptionIndex: 1,
        category: "Restaurant Onboarding",
        difficulty: "Easy"
    },
    {
        questionText: "What document is required to verify the bank account details for weekly or daily payout settlements during onboarding?",
        options: [
            "A copy of the restaurant menu",
            "A cancelled cheque or stamped bank passbook showing Account Number and IFSC code",
            "The owner's Aadhaar card copy only",
            "An electricity bill from the restaurant premises"
        ],
        correctOptionIndex: 1,
        category: "Restaurant Onboarding",
        difficulty: "Easy"
    },
    {
        questionText: "How should you address a restaurant owner's objection: 'We already get enough walk-in customers; we don't need online delivery'?",
        options: [
            "Agree and leave the restaurant immediately",
            "Explain that online delivery captures incremental revenue during off-peak hours without adding seating capacity or fixed overheads",
            "Tell them walk-in customers will stop coming soon",
            "Offer them zero commission for 5 years"
        ],
        correctOptionIndex: 1,
        category: "Restaurant Onboarding",
        difficulty: "Hard"
    },
    {
        questionText: "What is the recommended strategy for configuring portion sizes and add-ons (e.g., Extra Cheese, Half/Full) during menu setup?",
        options: [
            "Keep only single standard sizes to avoid confusing the kitchen",
            "Add rich customizations and add-ons to significantly increase Average Order Value (AOV) and customer choice",
            "Charge 50% extra for all customizations without displaying prices",
            "Limit add-ons to beverages only"
        ],
        correctOptionIndex: 1,
        category: "Restaurant Onboarding",
        difficulty: "Medium"
    },
    {
        questionText: "Why is menu price parity between dine-in and online pricing important for brand reputation on ITZO?",
        options: [
            "It ensures customers do not feel inflated prices online, leading to higher repeat orders and better ratings",
            "It is a legal requirement under the Indian Penal Code",
            "It allows ITZO riders to get free food",
            "It reduces the kitchen preparation time"
        ],
        correctOptionIndex: 0,
        category: "Restaurant Onboarding",
        difficulty: "Hard"
    },
    {
        questionText: "If a restaurant's FSSAI license is expiring within 20 days during onboarding, what is the correct protocol?",
        options: [
            "Reject onboarding permanently",
            "Onboard them conditionally while instructing them to initiate renewal immediately and upload the acknowledgment receipt",
            "Ignore the expiry date and onboard them normally",
            "Ask the restaurant to use another restaurant's license number"
        ],
        correctOptionIndex: 1,
        category: "Restaurant Onboarding",
        difficulty: "Hard"
    },
    {
        questionText: "What is the primary purpose of conducting physical kitchen hygiene and safety checks during your store onboarding visit?",
        options: [
            "To taste free food samples from the chef",
            "To ensure compliance with ITZO food safety standards, preventing food poisoning incidents and protecting customer trust",
            "To check if the kitchen tiles are imported",
            "To calculate the exact square footage for property tax"
        ],
        correctOptionIndex: 1,
        category: "Restaurant Onboarding",
        difficulty: "Easy"
    },
    {
        questionText: "How does ITZO's dynamic delivery radius work for freshly prepared restaurant food?",
        options: [
            "It delivers food to any city across India within 3 days",
            "It automatically adjusts delivery coverage based on food prep time, traffic conditions, and temperature retention SLAs",
            "It restricts delivery to a fixed 500-meter radius only",
            "It only allows deliveries to commercial office buildings"
        ],
        correctOptionIndex: 1,
        category: "Restaurant Onboarding",
        difficulty: "Medium"
    },
    {
        questionText: "During onboarding, why must you train kitchen staff on acknowledging orders within 3 minutes on the ITZO Partner App?",
        options: [
            "Because unacknowledged orders auto-cancel, leading to poor customer experience and algorithmic penalty on search ranking",
            "To test the touchscreen sensitivity of their smartphone",
            "Because ITZO charges a ₹1,000 fine for every minute delayed",
            "It is not necessary; orders can be acknowledged after food is cooked"
        ],
        correctOptionIndex: 0,
        category: "Restaurant Onboarding",
        difficulty: "Medium"
    },
    {
        questionText: "What is a 'Co-funded Discount' model in ITZO Food promotions?",
        options: [
            "The customer pays double the discount amount",
            "The promotional discount cost is shared between ITZO and the restaurant partner (e.g., 50-50 split) to drive volume",
            "The delivery rider pays for the discount from their tips",
            "The restaurant pays 100% of the discount while ITZO takes extra commission"
        ],
        correctOptionIndex: 1,
        category: "Restaurant Onboarding",
        difficulty: "Medium"
    },
    {
        questionText: "How should a restaurant partner handle customer reviews and ratings on their ITZO store page?",
        options: [
            "Ignore all reviews since they cannot be deleted",
            "Actively respond to feedback, apologize and resolve negative experiences, and thank loyal customers to boost store credibility",
            "File a police complaint against customers who give 3 stars",
            "Turn off the rating feature on the app"
        ],
        correctOptionIndex: 1,
        category: "Restaurant Onboarding",
        difficulty: "Easy"
    },
    {
        questionText: "When onboarding a Cloud Kitchen (virtual kitchen with no dine-in), what specific operational point must be verified?",
        options: [
            "That they have at least 10 dine-in tables",
            "That they have a dedicated, clean packaging/handover station and clear signage for ITZO delivery riders",
            "That they only operate between 1 AM and 4 AM",
            "That they do not list more than 5 items on the menu"
        ],
        correctOptionIndex: 1,
        category: "Restaurant Onboarding",
        difficulty: "Medium"
    },
    {
        questionText: "What is the benefit of setting up 'Combo Meals' (e.g., Burger + Fries + Coke) during initial menu setup?",
        options: [
            "It reduces packaging material costs to zero",
            "It simplifies decision-making for customers, increases order frequency, and raises Average Order Value (AOV)",
            "It allows restaurants to sell expired beverages",
            "It is mandatory for all restaurants on ITZO"
        ],
        correctOptionIndex: 1,
        category: "Restaurant Onboarding",
        difficulty: "Easy"
    },
    {
        questionText: "What should you do if a restaurant owner wants to list home-cooked food from a residential kitchen without FSSAI?",
        options: [
            "Onboard them immediately as a home chef without documents",
            "Politely explain that FSSAI registration is legally mandatory under food safety laws and guide them on how to apply online before onboarding",
            "Ask them to use their neighbor's trade license",
            "List them under the Quick Commerce retail category instead"
        ],
        correctOptionIndex: 1,
        category: "Restaurant Onboarding",
        difficulty: "Hard"
    },
    {
        questionText: "Why is it important to verify the exact GPS coordinates of the restaurant during your field onboarding check-in?",
        options: [
            "To ensure delivery riders are guided to the exact kitchen entrance, minimizing pickup delays and food cooling",
            "To track the restaurant owner's personal movements",
            "Because Google Maps charges a fee for incorrect addresses",
            "To verify if the restaurant is located in a posh neighborhood"
        ],
        correctOptionIndex: 0,
        category: "Restaurant Onboarding",
        difficulty: "Easy"
    },

    // ── Category 2: Quick Commerce Onboarding (20 Questions) ──
    {
        questionText: "What is the core value proposition of ITZO Quick Commerce (Q-Commerce) for retail and grocery stores?",
        options: [
            "Delivering bulk furniture within 7 days",
            "Ultra-fast 10 to 20-minute delivery of daily essentials, groceries, and FMCG products to hyper-local customers",
            "Wholesale B2B exporting to international markets",
            "Annual subscription boxes for books"
        ],
        correctOptionIndex: 1,
        category: "Quick Commerce Onboarding",
        difficulty: "Easy"
    },
    {
        questionText: "How does SKU (Stock Keeping Unit) volume differ when onboarding a supermarket vs a food restaurant?",
        options: [
            "Supermarkets have fewer items (10-20 SKUs) compared to restaurants",
            "Supermarkets typically onboard thousands of SKUs requiring barcode (EAN/UPC) scanning and structured categorization",
            "There is no difference in catalog size or complexity",
            "Supermarkets do not require pricing details on SKUs"
        ],
        correctOptionIndex: 1,
        category: "Quick Commerce Onboarding",
        difficulty: "Medium"
    },
    {
        questionText: "Why is real-time inventory synchronization vital for Quick Commerce sellers on ITZO?",
        options: [
            "It allows sellers to automatically increase MRP during rain",
            "Because out-of-stock items lead to order cancellations within minutes, severely damaging customer trust and store ranking",
            "It is only needed once a year during annual tax audit",
            "It helps the store owner track employee salaries"
        ],
        correctOptionIndex: 1,
        category: "Quick Commerce Onboarding",
        difficulty: "Hard"
    },
    {
        questionText: "What stock rotation methodology must be enforced for perishable dairy and bakery items in Q-Commerce stores?",
        options: [
            "LIFO (Last-In, First-Out)",
            "FIFO (First-In, First-Out) / FEFO (First-Expired, First-Out) to ensure customers receive fresh stock with maximum shelf life",
            "Random picking based on item color",
            "Selling items closest to expiry only at double price"
        ],
        correctOptionIndex: 1,
        category: "Quick Commerce Onboarding",
        difficulty: "Medium"
    },
    {
        questionText: "What is the standard order packing SLA (Service Level Agreement) for a store picker in an ITZO Quick Commerce dark store/partner store?",
        options: [
            "30 to 45 minutes",
            "Under 2 to 3 minutes from order notification to sealed bag handover",
            "Within 4 hours",
            "By the end of the business day"
        ],
        correctOptionIndex: 1,
        category: "Quick Commerce Onboarding",
        difficulty: "Hard"
    },
    {
        questionText: "When onboarding a retail grocery partner, how should variable-weight fresh produce (fruits, vegetables) be cataloged?",
        options: [
            "Sell them only by piece without mentioning weight",
            "Set clear standardized weight bands (e.g., 500g ± 20g) or enable weight-based billing adjustments on the merchant app",
            "Refuse to list fresh produce on Quick Commerce",
            "Charge a flat ₹500 for any bag of vegetables"
        ],
        correctOptionIndex: 1,
        category: "Quick Commerce Onboarding",
        difficulty: "Hard"
    },
    {
        questionText: "What packaging protocol must be followed for delivering heavy laundry detergents alongside fragile eggs or glass bottles?",
        options: [
            "Put everything into one single thin polythene bag",
            "Separate heavy chemicals from food items and use protective bubble wrap/cardboard partitioning for fragile items",
            "Ask the delivery rider to hold eggs in their hand while driving",
            "Do not allow customers to buy soap and eggs in the same order"
        ],
        correctOptionIndex: 1,
        category: "Quick Commerce Onboarding",
        difficulty: "Medium"
    },
    {
        questionText: "What mandatory document, besides GSTIN and PAN, is specifically required for retail shop onboarding in municipal limits?",
        options: [
            "A valid passport of all store salesmen",
            "Shop & Establishment Act License (Gumasta / Trade License) from local municipal authorities",
            "A driving license of the store owner",
            "A certificate of appreciation from a local politician"
        ],
        correctOptionIndex: 1,
        category: "Quick Commerce Onboarding",
        difficulty: "Medium"
    },
    {
        questionText: "How should a quick commerce store partner prepare for weekend or festival demand surges (e.g., Diwali, Rakhi, Holi)?",
        options: [
            "Close the store on festivals to enjoy a holiday",
            "Analyze historical ITZO demand forecasts, pre-pack high-velocity festive bundles, and maintain buffer stock of essentials",
            "Reduce inventory by 50% to prevent crowding",
            "Turn off the ITZO device during peak hours"
        ],
        correctOptionIndex: 1,
        category: "Quick Commerce Onboarding",
        difficulty: "Medium"
    },
    {
        questionText: "If a grocery store owner argues: 'Our margins on branded staples (flour, oil) are only 3-5%, how can we pay ITZO commission?' — what is the best pitch?",
        options: [
            "Tell them to stop selling staples and only sell chocolates",
            "Explain ITZO's blended margin model: high-margin FMCG, snacks, and personal care items offset staples, while ITZO drives massive volume turns and inventory velocity",
            "Offer them zero commission forever on all products",
            "Advise them to mix water in the oil to increase margins"
        ],
        correctOptionIndex: 1,
        category: "Quick Commerce Onboarding",
        difficulty: "Hard"
    },
    {
        questionText: "Why is setting up a dedicated 'ITZO Rapid Dispatch Counter' inside a partner supermarket recommended?",
        options: [
            "To charge customers an extra entry fee",
            "To prevent delivery riders from wandering inside the aisles, ensuring instant order verification and 30-second rider pickup handover",
            "Because municipal laws prohibit delivery riders from entering shops",
            "To store expired goods out of sight"
        ],
        correctOptionIndex: 1,
        category: "Quick Commerce Onboarding",
        difficulty: "Medium"
    },
    {
        questionText: "What is the ITZO policy regarding MRP (Maximum Retail Price) compliance on Quick Commerce catalogs?",
        options: [
            "Sellers can list prices 20% above MRP to cover delivery costs",
            "Selling above printed MRP is strictly illegal under Legal Metrology laws; listed selling price must be equal to or lower than printed MRP",
            "MRP rules only apply to imported goods",
            "Sellers can scratch off the MRP printed on the packet"
        ],
        correctOptionIndex: 1,
        category: "Quick Commerce Onboarding",
        difficulty: "Easy"
    },
    {
        questionText: "How does barcode scanning on the ITZO Quick Commerce Merchant App benefit store inventory management?",
        options: [
            "It plays a beep sound to entertain customers",
            "It ensures 100% picking accuracy, eliminates manual item mismatch errors, and instantly updates stock levels",
            "It automatically orders new stock from China",
            "It increases the battery life of the store POS terminal"
        ],
        correctOptionIndex: 1,
        category: "Quick Commerce Onboarding",
        difficulty: "Easy"
    },
    {
        questionText: "What should you do if a kirana store has excellent inventory but poor cellular/Wi-Fi connectivity inside the store?",
        options: [
            "Onboard them anyway and blame the telecom provider later",
            "Advise and assist them in setting up a reliable Wi-Fi router or placing the ITZO order terminal near the front entrance/window for seamless order alerts",
            "Tell them to check orders only once every 4 hours when they step outside",
            "Ask delivery riders to shout orders from the street"
        ],
        correctOptionIndex: 1,
        category: "Quick Commerce Onboarding",
        difficulty: "Medium"
    },
    {
        questionText: "What is the significance of 'No Minimum Order Value' for customers on ITZO Quick Commerce?",
        options: [
            "It causes the store to lose money on every order",
            "It encourages high-frequency impulse purchases (e.g., a single packet of milk or snacks), driving daily active usage and store loyalty",
            "It is only applicable for orders delivered after midnight",
            "It requires riders to deliver on foot"
        ],
        correctOptionIndex: 1,
        category: "Quick Commerce Onboarding",
        difficulty: "Medium"
    },
    {
        questionText: "How can Quick Commerce sellers leverage ITZO Sponsored Brand Ads and Banner Placements?",
        options: [
            "By paying cash directly to field sales executives without invoice",
            "By boosting search visibility for high-margin FMCG brands, capturing top-of-mind awareness during hyper-local customer searches",
            "By blocking competitor stores from opening in the city",
            "By sending SMS spam to all phone numbers in India"
        ],
        correctOptionIndex: 1,
        category: "Quick Commerce Onboarding",
        difficulty: "Hard"
    },
    {
        questionText: "What is the procedure when a customer initiates a return for a damaged retail product delivered via ITZO Quick Commerce?",
        options: [
            "The store owner must personally visit the customer's house to argue",
            "The ITZO support system verifies photographic proof, processes customer refund, and coordinates reverse pickup or vendor debit as per SLA terms",
            "The delivery rider is forced to buy the damaged item",
            "Returns are strictly prohibited even if the product is rotten"
        ],
        correctOptionIndex: 1,
        category: "Quick Commerce Onboarding",
        difficulty: "Medium"
    },
    {
        questionText: "Why is onboarding pharmacies / chemists onto ITZO Quick Commerce subject to additional regulatory scrutiny?",
        options: [
            "Because medicines are heavy to carry",
            "They must possess a valid Drug License (Form 20/21) and adhere to strict prescription verification protocols for Schedule H/X drugs",
            "Because pharmacies do not open on Sundays",
            "They are exempted from paying GST"
        ],
        correctOptionIndex: 1,
        category: "Quick Commerce Onboarding",
        difficulty: "Hard"
    },
    {
        questionText: "What is a 'Dark Store' in the ITZO Quick Commerce ecosystem?",
        options: [
            "A store that operates without electricity to save power",
            "A dedicated micro-fulfillment warehouse closed to retail walk-in shoppers, optimized entirely for rapid 2-minute order picking and dispatch",
            "An illegal warehouse selling counterfeit goods",
            "A store open only during solar eclipses"
        ],
        correctOptionIndex: 1,
        category: "Quick Commerce Onboarding",
        difficulty: "Easy"
    },
    {
        questionText: "During quick commerce onboarding, why should you check the store's operating hours and encourage early morning (6 AM) opening?",
        options: [
            "Because field employees start work at 6 AM",
            "To capture massive high-intent morning demand for daily milk, bread, eggs, and breakfast essentials",
            "Because municipal taxes are lower before 8 AM",
            "To avoid afternoon traffic jams"
        ],
        correctOptionIndex: 1,
        category: "Quick Commerce Onboarding",
        difficulty: "Medium"
    },

    // ── Category 3: Sales & Pitching (20 Questions) ──
    {
        questionText: "What is the most effective structure for an initial 30-second elevator pitch when walking into a busy restaurant?",
        options: [
            "Read out the entire 15-page ITZO legal contract word-for-word",
            "Hook their interest with quantified local success (e.g., 'We helped Restaurant X nearby add ₹3 Lakhs monthly'), state ITZO's rapid delivery advantage, and ask for a 5-minute meeting",
            "Complain about how hard it is to park outside their store",
            "Ask them to give you a free lunch before you explain who you are"
        ],
        correctOptionIndex: 1,
        category: "Sales & Pitching",
        difficulty: "Medium"
    },
    {
        questionText: "What is the 'Consultative Selling' approach in B2B merchant onboarding?",
        options: [
            "Telling the merchant they know nothing about business",
            "Asking insightful, open-ended questions to diagnose their operational bottlenecks (e.g., weekday slump, excess prep capacity) before tailoring the ITZO solution",
            "Offering 90% discount on commission within the first 10 seconds of meeting",
            "Refusing to answer merchant questions until they sign the form"
        ],
        correctOptionIndex: 1,
        category: "Sales & Pitching",
        difficulty: "Medium"
    },
    {
        questionText: "How should you respond to the common objection: 'Swiggy and Zomato are already giving us orders; why should we list on ITZO?'",
        options: [
            "Criticize competitors and claim their apps will shut down tomorrow",
            "Highlight ITZO's unique hyper-local customer base, lower commission structure, faster 20-minute delivery promise, and the risk of leaving incremental market share to competitors",
            "Tell them they are legally required to list on all apps",
            "Walk away immediately without saying anything"
        ],
        correctOptionIndex: 1,
        category: "Sales & Pitching",
        difficulty: "Hard"
    },
    {
        questionText: "What is the 'Feel, Felt, Found' negotiation technique for overcoming merchant skepticism?",
        options: [
            "A method of checking if the food feels hot or cold",
            "Empathizing ('I understand how you feel about discounting; Partner X felt the same way initially, but they found our targeted promos increased net profits by 35%')",
            "A psychological trick to make merchants forget their bank details",
            "An aggressive closing technique where you demand immediate signature"
        ],
        correctOptionIndex: 1,
        category: "Sales & Pitching",
        difficulty: "Hard"
    },
    {
        questionText: "How can you effectively create ethical urgency to close an onboarding agreement during your second visit?",
        options: [
            "Threaten to report their kitchen to municipal health inspectors if they don't sign",
            "Introduce a time-sensitive launch incentive, such as zero onboarding fees or ₹5,000 in free sponsored ad credits for partners going live this week",
            "Tell them the ITZO app is running out of server space",
            "Sit in their restaurant and refuse to leave until they sign"
        ],
        correctOptionIndex: 1,
        category: "Sales & Pitching",
        difficulty: "Medium"
    },
    {
        questionText: "When dealing with a gatekeeper (cashier, receptionist, junior manager), what is the best strategy to reach the restaurant owner?",
        options: [
            "Treat them with genuine respect, explain how ITZO will make their daily order handling easier, and ask for the best time or appointment to speak with the decision-maker",
            "Bribe them with free food coupons",
            "Argue with them and demand owner's personal home phone number",
            "Ignore them and walk straight into the kitchen or private office"
        ],
        correctOptionIndex: 0,
        category: "Sales & Pitching",
        difficulty: "Medium"
    },
    {
        questionText: "What is an 'Assumptive Close' in merchant onboarding sales?",
        options: [
            "Assuming the merchant will never sign and leaving",
            "Proceeding with positive momentum by asking operational questions: 'Shall we link your HDFC or ICICI bank account for your weekly payout settlements?'",
            "Assuming you will get a promotion if you onboard 10 stores today",
            "Closing your presentation laptop before finishing the pitch"
        ],
        correctOptionIndex: 1,
        category: "Sales & Pitching",
        difficulty: "Hard"
    },
    {
        questionText: "How should you present ITZO's platform commission rate during a commercial negotiation?",
        options: [
            "Hide the number in small print at the bottom of the contract",
            "Present it transparently as an investment in hyper-local customer acquisition, payment gateway processing, customer service, and rapid rider logistics",
            "Apologize profusely and say you know it is overpriced",
            "Tell them commission is optional and they can pay whatever they like"
        ],
        correctOptionIndex: 1,
        category: "Sales & Pitching",
        difficulty: "Medium"
    },
    {
        questionText: "What is the primary objective of using an 'ROI Calculator' or earnings projection sheet during a sales pitch?",
        options: [
            "To show off your advanced Excel skills",
            "To visually demonstrate how incremental online orders cover fixed kitchen costs, turning platform fees into high-margin net profit",
            "To confuse the merchant with complex mathematical formulas",
            "To calculate the restaurant's electricity bill"
        ],
        correctOptionIndex: 1,
        category: "Sales & Pitching",
        difficulty: "Easy"
    },
    {
        questionText: "If a merchant demands a custom lower commission rate that is below ITZO's approved floor price, what should you do?",
        options: [
            "Immediately agree just to get the onboarding count",
            "Politely stand firm on platform parity, but offer value-adds like free food photography, premium banner placement, or co-funded launch promotions",
            "Tell the merchant they are greedy and unprofessional",
            "Forge the sales manager's signature on a discounted agreement"
        ],
        correctOptionIndex: 1,
        category: "Sales & Pitching",
        difficulty: "Hard"
    },
    {
        questionText: "What is 'Cross-Selling' in the context of an ITZO field sales executive?",
        options: [
            "Selling ITZO t-shirts to restaurant customers",
            "Pitching Quick Commerce retail listing to a restaurant partner that also sells packaged gourmet sauces, bakery cookies, or signature spice blends",
            "Crossing the street to visit a competitor's office",
            "Selling two different restaurant brands under the exact same name"
        ],
        correctOptionIndex: 1,
        category: "Sales & Pitching",
        difficulty: "Medium"
    },
    {
        questionText: "Why is social proof (e.g., testimonials or order volumes of nearby popular stores) powerful in local B2B sales?",
        options: [
            "It proves you know local gossip",
            "It triggers FOMO (Fear Of Missing Out) and builds credibility by showing that peer businesses in their exact neighborhood are succeeding on ITZO",
            "It is required by RBI guidelines for commercial contracts",
            "It allows you to share competitor bank account details legally"
        ],
        correctOptionIndex: 1,
        category: "Sales & Pitching",
        difficulty: "Easy"
    },
    {
        questionText: "What is the 'Alternative Choice Close' technique when finalizing an onboarding schedule?",
        options: [
            "Asking: 'Do you want to onboard on ITZO or shut down your store?'",
            "Asking: 'Would you prefer our team to conduct the food photography session this Tuesday morning or Thursday afternoon?'",
            "Giving the merchant a choice between paying in US Dollars or Euros",
            "Telling them they can choose any commission rate between 0% and 1%"
        ],
        correctOptionIndex: 1,
        category: "Sales & Pitching",
        difficulty: "Medium"
    },
    {
        questionText: "How should you handle a situation where the restaurant owner is interested, but their business partner/co-owner is skeptical?",
        options: [
            "Tell the interested owner to ignore their partner and sign secretly",
            "Offer to host a joint 10-minute briefing or video call with both partners to address all operational and financial concerns transparently",
            "Cancel the onboarding lead permanently",
            "Send an angry email to the skeptical partner"
        ],
        correctOptionIndex: 1,
        category: "Sales & Pitching",
        difficulty: "Medium"
    },
    {
        questionText: "What is the significance of identifying the 'Economic Buyer' vs the 'User' during a restaurant sales pitch?",
        options: [
            "There is no difference; everyone in the restaurant has equal signing authority",
            "The Chef/Manager (User) cares about app ease-of-use and kitchen prep flow, while the Owner/Accountant (Economic Buyer) cares about ROI, payouts, and commission",
            "The Economic Buyer is the person who buys vegetables in the morning",
            "You should only speak to the dishwasher to get onboarding approval"
        ],
        correctOptionIndex: 1,
        category: "Sales & Pitching",
        difficulty: "Hard"
    },
    {
        questionText: "Why is post-onboarding follow-up (Key Account Management) critical for field sales executives?",
        options: [
            "Because your job ends only when the restaurant shuts down",
            "Early operational support during the first 14 days prevents churn, resolves app glitches, optimizes menu conversion, and drives long-term partner retention",
            "To eat free meals at the partner restaurant every week",
            "It is not important; once signed, you should never contact the merchant again"
        ],
        correctOptionIndex: 1,
        category: "Sales & Pitching",
        difficulty: "Easy"
    },
    {
        questionText: "What is the best way to present ITZO's hyper-local advertising and sponsored ad solutions to an established merchant?",
        options: [
            "Describe it as a mandatory tax they must pay to ITZO",
            "Present it as a high-return customer acquisition engine that puts their brand at the top of search results precisely when hungry locals are ready to order",
            "Tell them ads are guaranteed to make them millionaires overnight",
            "Say that without buying ads, their store will be hidden from all users"
        ],
        correctOptionIndex: 1,
        category: "Sales & Pitching",
        difficulty: "Medium"
    },
    {
        questionText: "How should you respond if a merchant says: 'Let me think about it and call you back next month'?",
        options: [
            "Say 'Okay, goodbye' and delete their contact",
            "Uncover the underlying hesitation by asking politely: 'Of course! Just to clarify, is it the operational kitchen setup or the commercial terms that you'd like more time to evaluate?'",
            "Call them 15 times every day until they answer",
            "Tell them the onboarding offer expires in 5 minutes"
        ],
        correctOptionIndex: 1,
        category: "Sales & Pitching",
        difficulty: "Hard"
    },
    {
        questionText: "What is the golden rule of competitor differentiation when pitching ITZO Food?",
        options: [
            "Never mention competitors at all under any circumstances",
            "Focus on ITZO's distinct strengths (faster 20-min logistics, dedicated merchant support, fair commissions, transparent payouts) without bad-mouthing rivals",
            "Make up false legal accusations against competitor apps",
            "Claim that ITZO invented food delivery"
        ],
        correctOptionIndex: 1,
        category: "Sales & Pitching",
        difficulty: "Medium"
    },
    {
        questionText: "Why is grooming, punctuality, and professional presentation essential for ITZO field onboarding executives?",
        options: [
            "To win a fashion contest at the regional office",
            "You represent the ITZO brand; professional attire and punctuality build immediate executive trust and respect with business owners",
            "Because restaurants do not allow casually dressed people inside",
            "It has zero impact on B2B sales success"
        ],
        correctOptionIndex: 1,
        category: "Sales & Pitching",
        difficulty: "Easy"
    },

    // ── Category 4: Communication & Negotiation (20 Questions) ──
    {
        questionText: "What is 'Active Listening' during a merchant onboarding negotiation?",
        options: [
            "Interrupting the merchant every 5 seconds to correct their grammar",
            "Fully concentrating, making eye contact, nodding, and summarizing the merchant's operational concerns before offering an ITZO solution",
            "Listening to music on earphones while the merchant speaks",
            "Pretending to listen while secretly texting on your phone"
        ],
        correctOptionIndex: 1,
        category: "Communication & Negotiation",
        difficulty: "Easy"
    },
    {
        questionText: "When conducting a face-to-face meeting with a local kiranawala or restaurant owner, which language strategy is best?",
        options: [
            "Speak only in high-level, complex American English business jargon",
            "Use clear, respectful local language (Hindi or regional tongue) combined with simple, professional e-commerce terms",
            "Speak as fast as possible so they cannot ask questions",
            "Use slang and informal street language to sound cool"
        ],
        correctOptionIndex: 1,
        category: "Communication & Negotiation",
        difficulty: "Easy"
    },
    {
        questionText: "How should you write a professional follow-up summary message via WhatsApp or Email after an initial sales meeting?",
        options: [
            "Send a single thumbs-up emoji 👍",
            "Clearly outline key points discussed, agreed commercial terms, required onboarding documents (PAN, FSSAI, GST), and next steps with deadlines",
            "Send 20 voice notes of 5 minutes each",
            "Write a 10-page essay complaining about the weather"
        ],
        correctOptionIndex: 1,
        category: "Communication & Negotiation",
        difficulty: "Medium"
    },
    {
        questionText: "What is the best de-escalation strategy when dealing with an angry restaurant owner upset about a delayed rider pickup from last week?",
        options: [
            "Shout back and tell them it was entirely their kitchen's fault",
            "Listen patiently without interrupting, acknowledge their frustration empathetically, explain the root cause, and share the concrete steps ITZO is taking to prevent recurrence",
            "Walk out of the restaurant while they are talking",
            "Tell them you are just a sales guy and don't care about delivery riders"
        ],
        correctOptionIndex: 1,
        category: "Communication & Negotiation",
        difficulty: "Hard"
    },
    {
        questionText: "What is the difference between a 'Win-Win' negotiation and 'Zero-Sum' bargaining in ITZO onboarding?",
        options: [
            "Win-Win means ITZO takes 100% profit; Zero-Sum means restaurant takes 100%",
            "Win-Win creates mutual sustainable growth (e.g., co-funded promos driving volume); Zero-Sum treats every margin percentage as an adversarial battle",
            "Win-Win is illegal in commercial agreements",
            "There is no difference in sales psychology"
        ],
        correctOptionIndex: 1,
        category: "Communication & Negotiation",
        difficulty: "Hard"
    },
    {
        questionText: "How should you handle tactical silence from a merchant after you state the platform commission rate?",
        options: [
            "Panic immediately and offer a 5% discount to break the silence",
            "Maintain calm, confident body language and allow the merchant time to process the proposal without interrupting their train of thought",
            "Start humming a song or checking your social media feeds",
            "Ask them if they have fallen asleep"
        ],
        correctOptionIndex: 1,
        category: "Communication & Negotiation",
        difficulty: "Hard"
    },
    {
        questionText: "When explaining technical requirements (e.g., Wi-Fi connectivity, printer pairing, app notifications) to a non-tech-savvy shopkeeper, what is the rule?",
        options: [
            "Use complex programming terms like 'API endpoints' and 'WebSocket latency'",
            "Use simple analogies, demonstrate step-by-step on their own phone, and provide a clear visual printed guide in local language",
            "Tell them they are too old to run an online business",
            "Refuse to onboard them unless they hire a computer engineer"
        ],
        correctOptionIndex: 1,
        category: "Communication & Negotiation",
        difficulty: "Medium"
    },
    {
        questionText: "How can you politely redirect a conversation when a talkative restaurant owner goes off-topic into local politics during a tight sales schedule?",
        options: [
            "Tell them to shut up and stick to business",
            "Acknowledge their comment politely and smoothly bridge back: 'That's a fascinating perspective on local development! Speaking of local growth, let's look at how ITZO captures this neighborhood demand...'",
            "Start arguing with their political opinions",
            "Abruptly stand up and walk out"
        ],
        correctOptionIndex: 1,
        category: "Communication & Negotiation",
        difficulty: "Medium"
    },
    {
        questionText: "What is the importance of vocal tone and clarity when making cold outreach phone calls to prospective quick commerce sellers?",
        options: [
            "A warm, confident, and articulate tone builds instant rapport and prevents immediate hang-ups, while a monotonous or aggressive tone destroys trust",
            "You should speak in a whisper so nobody else hears the deal",
            "Tone does not matter as long as you read the script rapidly",
            "You should sound angry to show executive authority"
        ],
        correctOptionIndex: 0,
        category: "Communication & Negotiation",
        difficulty: "Easy"
    },
    {
        questionText: "How should you professionally handle a definitive 'No' from a merchant after a full presentation?",
        options: [
            "Tear up their menu and insult their food quality",
            "Thank them graciously for their time, leave a professional brochure and your contact card, and request permission to check back in three months as their business expands",
            "Refuse to leave until they call police",
            "Send an anonymous bad review on Google Maps"
        ],
        correctOptionIndex: 1,
        category: "Communication & Negotiation",
        difficulty: "Medium"
    },
    {
        questionText: "What is the correct protocol for communicating an SLA breach (e.g., kitchen preparation delays causing rider wait time) to a Head Chef?",
        options: [
            "Storm into the kitchen and scream at the cooking staff in front of dine-in guests",
            "Request a private word with the Chef/Manager during off-peak hours, share objective data from the partner app, and collaboratively find workflow adjustments",
            "Deduct money directly from the cashier's drawer",
            "Ignore it completely and let orders get cancelled"
        ],
        correctOptionIndex: 1,
        category: "Communication & Negotiation",
        difficulty: "Hard"
    },
    {
        questionText: "How do you reframe a merchant's negative statement: 'Your delivery riders are always in a rush and crowd my billing counter' into a positive collaborative solution?",
        options: [
            "Agree that all delivery riders are undisciplined and should be banned",
            "Reframe: 'High rider activity shows strong order volume! Let's set up a designated ITZO Express Pickup Signage 5 feet away from your cash counter to streamline traffic and keep dine-in guests comfortable'",
            "Tell the owner their store is too small",
            "Cancel all delivery rider assignments to that store"
        ],
        correctOptionIndex: 1,
        category: "Communication & Negotiation",
        difficulty: "Hard"
    },
    {
        questionText: "Why is transparency regarding statutory deductions (GST, TCS, TDS) crucial during financial onboarding discussions?",
        options: [
            "It is not crucial; you should hide tax deductions to make payouts look bigger",
            "Complete financial transparency builds unbreakable professional trust and prevents bitter accounting disputes during the first weekly payout settlement",
            "Because ITZO keeps the tax money as extra profit",
            "It allows you to skip taking their PAN card copy"
        ],
        correctOptionIndex: 1,
        category: "Communication & Negotiation",
        difficulty: "Medium"
    },
    {
        questionText: "What is the best communication practice when conducting a group onboarding training session for 10 kitchen and billing staff members?",
        options: [
            "Speak strictly to the owner and ignore the staff members who actually operate the app",
            "Make the session interactive, encourage hands-on practice with mock order acceptance on the tablet, answer staff questions patiently, and celebrate correct responses",
            "Give a 3-hour boring theoretical lecture without touching the device",
            "Scold staff members who ask basic questions"
        ],
        correctOptionIndex: 1,
        category: "Communication & Negotiation",
        difficulty: "Medium"
    },
    {
        questionText: "When negotiating a co-funded promotional campaign (e.g., 'BUY 1 GET 1 FREE'), how should you frame the financial investment to the partner?",
        options: [
            "Tell them they are giving away free food at a massive loss",
            "Frame it as a high-conversion customer acquisition cost (CAC) co-invested by ITZO, designed to sample signature dishes to thousands of new local eaters who convert into full-price repeat buyers",
            "Claim that ITZO pays 100% of the cost even when it is 50-50",
            "Force them to run the discount for 365 days continuously"
        ],
        correctOptionIndex: 1,
        category: "Communication & Negotiation",
        difficulty: "Hard"
    },
    {
        questionText: "What is the significance of non-verbal communication (posture, facial expression, grooming) during B2B field onboarding?",
        options: [
            "Non-verbal cues account for over 50% of first impressions; an open, confident posture and friendly smile project competence and integrity before you speak a word",
            "Non-verbal communication is only relevant for actors",
            "You should cross your arms tightly and scowl to look serious",
            "It is best to wear sunglasses indoors to look mysterious"
        ],
        correctOptionIndex: 0,
        category: "Communication & Negotiation",
        difficulty: "Easy"
    },
    {
        questionText: "How should you handle cultural or regional communication nuances across diverse Indian cities and market associations?",
        options: [
            "Force everyone to follow one rigid cultural style regardless of location",
            "Respect local business customs, traditional greetings, and regional market association rules (e.g., local union guidelines or afternoon rest hours in traditional markets)",
            "Make fun of regional accents during meetings",
            "Refuse to meet merchants who do not speak fluent English"
        ],
        correctOptionIndex: 1,
        category: "Communication & Negotiation",
        difficulty: "Medium"
    },
    {
        questionText: "What is the best way to communicate an upcoming ITZO platform fee adjustment or policy change to existing partners?",
        options: [
            "Disconnect their phone calls when they notice the bill",
            "Provide proactive, advanced written communication accompanied by a consultative visit or call to explain the enhanced value and new features supporting the policy update",
            "Send a midnight SMS threatening store deactivation",
            "Blame the government for all pricing updates"
        ],
        correctOptionIndex: 1,
        category: "Communication & Negotiation",
        difficulty: "Hard"
    },
    {
        questionText: "During a negotiation, what is 'BATNA' (Best Alternative To a Negotiated Agreement)?",
        options: [
            "A new South Indian snack item on the menu",
            "Your fallback option or walk-away point if the merchant refuses minimum viable commercial terms, ensuring you don't sign unprofitable or high-risk agreements",
            "A secret discount code given only to VIP merchants",
            "The legal term for a cancelled bank cheque"
        ],
        correctOptionIndex: 1,
        category: "Communication & Negotiation",
        difficulty: "Hard"
    },
    {
        questionText: "Why is summarizing and confirming verbal agreements in writing at the end of a meeting mandatory?",
        options: [
            "To waste paper and ink",
            "It eliminates ambiguity, prevents memory lapses or misunderstandings, and serves as an authoritative reference during legal document execution",
            "Because merchants always lie about what they agreed to",
            "It is required by Google Maps regulations"
        ],
        correctOptionIndex: 1,
        category: "Communication & Negotiation",
        difficulty: "Easy"
    },

    // ── Category 5: ITZO Platform & Tech Knowledge (20 Questions) ──
    {
        questionText: "How does the ITZO intelligent order assignment algorithm match delivery riders to restaurant partners?",
        options: [
            "It assigns orders randomly to riders who are sitting at home",
            "It factors in real-time rider GPS proximity, food preparation SLA, traffic congestion, and order batching efficiency to ensure hot food arrival in 20 minutes",
            "It only assigns orders to riders who give tips to the dispatcher",
            "It waits until the food is completely cold before searching for a rider"
        ],
        correctOptionIndex: 1,
        category: "ITZO Platform Knowledge",
        difficulty: "Medium"
    },
    {
        questionText: "What is the default order acceptance timeout window on the ITZO Restaurant Partner App before an order is auto-cancelled and reassigned?",
        options: [
            "30 minutes",
            "3 minutes (180 seconds) with continuous high-decibel audio alerting",
            "24 hours",
            "There is no timeout; orders wait indefinitely"
        ],
        correctOptionIndex: 1,
        category: "ITZO Platform Knowledge",
        difficulty: "Medium"
    },
    {
        questionText: "How can a restaurant chef temporarily toggle an item as 'Out of Stock' during a sudden ingredient shortage on the Partner App?",
        options: [
            "They must call the ITZO CEO in Bangalore",
            "With two taps on the Partner App Menu Management screen, selecting either 'Out of stock for today' or 'Out of stock indefinitely'",
            "They must uninstall and reinstall the app",
            "They cannot turn off items; they must cook without ingredients"
        ],
        correctOptionIndex: 1,
        category: "ITZO Platform Knowledge",
        difficulty: "Easy"
    },
    {
        questionText: "What is the purpose of the 'Store Busy / High Demand Mode' on the ITZO Quick Commerce Partner App?",
        options: [
            "It shuts down the store permanently",
            "It temporarily adds a dynamic buffer time (e.g., +10 mins) to delivery estimates or throttles incoming order velocity to let kitchen/pickers clear backlog cleanly",
            "It increases the price of all items by 500%",
            "It plays loud party music from the tablet speaker"
        ],
        correctOptionIndex: 1,
        category: "ITZO Platform Knowledge",
        difficulty: "Hard"
    },
    {
        questionText: "How does the ITZO Merchant Dashboard calculate the Net Weekly Payout transferred to the partner's bank account?",
        options: [
            "Gross Order Value minus Platform Commission, minus applicable GST on commission, minus statutory TDS/TDS under Income Tax & GST laws, plus/minus promotional adjustments",
            "It is just 50% of whatever the restaurant sold",
            "Gross Order Value without any deductions or taxes",
            "It is decided randomly by the accounting department every Monday"
        ],
        correctOptionIndex: 0,
        category: "ITZO Platform Knowledge",
        difficulty: "Hard"
    },
    {
        questionText: "What criteria must a restaurant consistently meet to earn and retain the prestigious 'ITZO Top Rated / Bestseller' badge?",
        options: [
            "Paying a ₹50,000 monthly bribe to the sales executive",
            "Maintaining a customer rating above 4.2+, order cancellation rate below 1%, average kitchen prep time under 12 mins, and high hygiene compliance",
            "Serving only imported Italian cuisine",
            "Having an illuminated neon sign outside their physical shop"
        ],
        correctOptionIndex: 1,
        category: "ITZO Platform Knowledge",
        difficulty: "Medium"
    },
    {
        questionText: "How does ITZO's automated customer support system handle customer refund claims for reported missing food items?",
        options: [
            "It automatically deducts 100% money from the restaurant without investigation",
            "It checks rider tamper-evident bag seal verification, historical customer claim frequency, and partner kitchen packaging records before debiting or absorbing liability as per SLA",
            "It sends a police squad to arrest the chef",
            "It refuses all refund claims even if the box was completely empty"
        ],
        correctOptionIndex: 1,
        category: "ITZO Platform Knowledge",
        difficulty: "Hard"
    },
    {
        questionText: "Where can field onboarding executives check the real-time document verification status (FSSAI, GST, Bank) of a newly submitted lead?",
        options: [
            "By looking at the local newspaper advertisements",
            "Inside the internal ITZO HRMS / ECS Admin Onboarding Tracker portal under 'Merchant Leads / Document Status'",
            "By calling customer support toll-free number",
            "By asking the delivery riders on the street"
        ],
        correctOptionIndex: 1,
        category: "ITZO Platform Knowledge",
        difficulty: "Easy"
    },
    {
        questionText: "What are the three most vital performance metrics displayed on the merchant's ITZO Partner Analytics dashboard?",
        options: [
            "Number of chairs in restaurant, color of chef uniform, and electricity consumption",
            "Store Conversion Rate (Menu views to Orders), Average Order Value (AOV), and Average Preparation Time",
            "Weather forecast, stock market index, and gold prices",
            "Rider shoe size, bicycle speed, and helmet color"
        ],
        correctOptionIndex: 1,
        category: "ITZO Platform Knowledge",
        difficulty: "Medium"
    },
    {
        questionText: "How does ITZO differentiate financial liability between Customer-Initiated Cancellations vs Restaurant-Initiated Cancellations?",
        options: [
            "The delivery rider pays for all cancellations always",
            "If customer cancels after kitchen prep starts, restaurant receives guaranteed payout; if restaurant cancels due to out-of-stock/delay, restaurant bears penalty and refund liability",
            "ITZO pays 100% money to everyone for every cancellation",
            "The customer is jailed for cancelling an order"
        ],
        correctOptionIndex: 1,
        category: "ITZO Platform Knowledge",
        difficulty: "Hard"
    },
    {
        questionText: "What is the standard onboarding document verification SLA (time taken from document upload to store going live on app)?",
        options: [
            "3 to 6 months",
            "24 to 48 working hours, provided all scanned documents (PAN, GSTIN, FSSAI, Cheque) are legible and valid",
            "Instantaneous within 5 seconds without human verification",
            "Exactly 30 business days"
        ],
        correctOptionIndex: 1,
        category: "ITZO Platform Knowledge",
        difficulty: "Easy"
    },
    {
        questionText: "How do ITZO Sponsored Brand Ads operate on a Cost-Per-Click (CPC) / Cost-Per-Order (CPO) bidding model?",
        options: [
            "Sellers pay a fixed ₹1 Lakh upfront regardless of results",
            "Sellers set a daily wallet budget and bid for top placement; they are charged only when a hungry user actually clicks their ad banner or places an order",
            "Ads are shown randomly only to users who do not have smartphones",
            "ITZO charges money every time the store owner opens their own app"
        ],
        correctOptionIndex: 1,
        category: "ITZO Platform Knowledge",
        difficulty: "Hard"
    },
    {
        questionText: "What is the role of the ITZO Field Employee GPS tracking system during physical store onboarding visits?",
        options: [
            "To drain the smartphone battery as fast as possible",
            "It validates field attendance, records exact store geocoding coordinates for rider navigation, and verifies genuine on-site merchant sales visits in the HRMS portal",
            "It secretly records private phone conversations of merchants",
            "It allows field employees to watch movies while driving"
        ],
        correctOptionIndex: 1,
        category: "ITZO Platform Knowledge",
        difficulty: "Medium"
    },
    {
        questionText: "How can merchants configure automated promotional discount coupons (e.g., 'FLAT ₹100 OFF on orders above ₹399') on their app?",
        options: [
            "They must print paper coupons and distribute them on the road",
            "Via the 'Promotions & Growth' tab on the Partner App/Portal, selecting target audience (New vs Repeat users), minimum spend, and campaign dates with real-time analytics",
            "They must send an email to the Prime Minister of India",
            "They cannot create discounts; only ITZO engineers can code discounts"
        ],
        correctOptionIndex: 1,
        category: "ITZO Platform Knowledge",
        difficulty: "Medium"
    },
    {
        questionText: "What is the technical onboarding procedure for a Cloud Kitchen operating multiple virtual brands from one single physical kitchen?",
        options: [
            "They must rent 5 separate physical buildings",
            "Each brand gets a distinct ITZO Store ID and digital menu mapped to the same physical GPS address, FSSAI license (with multi-brand endorsement), and payout bank account",
            "Multi-brand cloud kitchens are strictly banned on ITZO",
            "They must use different delivery riders for each brand"
        ],
        correctOptionIndex: 1,
        category: "ITZO Platform Knowledge",
        difficulty: "Hard"
    },
    {
        questionText: "How does ITZO handle customer food quality hygiene complaints and municipal health inspection audit reports?",
        options: [
            "By deleting the customer's ITZO account immediately",
            "Severe hygiene breaches trigger temporary store suspension on the app until the partner submits a certified pest-control/hygiene audit report and kitchen safety video proof",
            "By sending free ice cream to the customer",
            "ITZO has zero rules regarding food safety or hygiene"
        ],
        correctOptionIndex: 1,
        category: "ITZO Platform Knowledge",
        difficulty: "Hard"
    },
    {
        questionText: "What is the formal procedure for transferring store ownership or changing registered bank account details on ITZO?",
        options: [
            "The new owner simply starts using the old owner's phone",
            "Submitting an official Change of Ownership / Bank Update request with new PAN, cancelled cheque, KYC docs, and NOC (No Objection Certificate) from the previous owner for legal audit",
            "Sending a WhatsApp message to the delivery rider",
            "Bank account details can never be changed once registered"
        ],
        correctOptionIndex: 1,
        category: "ITZO Platform Knowledge",
        difficulty: "Medium"
    },
    {
        questionText: "How does ITZO's 'Scheduled Ordering' feature work for dining reservations, custom cakes, and party catering?",
        options: [
            "Customers can order food 10 years in advance",
            "It allows customers to pre-order up to 48 hours in advance; the Partner App alerts the kitchen at the exact required prep time before scheduled dispatch or guest arrival",
            "Scheduled ordering is only available for buying raw vegetables",
            "Riders sit outside the restaurant for 24 hours waiting for scheduled orders"
        ],
        correctOptionIndex: 1,
        category: "ITZO Platform Knowledge",
        difficulty: "Medium"
    },
    {
        questionText: "Where can field employees report technical app bugs or document upload failures encountered during an on-site onboarding meeting?",
        options: [
            "Post about it on Instagram and tag random celebrities",
            "Use the 'Report Tech Glitch / Help & Support' ticket system inside the ITZO HRMS / Field App, attaching error screenshots and merchant lead ID for rapid L2 resolution",
            "Tell the merchant to buy a new computer",
            "Throw the tablet away and stop onboarding"
        ],
        correctOptionIndex: 1,
        category: "ITZO Platform Knowledge",
        difficulty: "Easy"
    },
    {
        questionText: "What is the primary security benefit of OTP-verified rider handover for high-value quick commerce orders?",
        options: [
            "It slows down the delivery process intentionally",
            "It ensures 100% chain-of-custody verification, preventing package theft, missing item disputes, or wrong order pickup between store pickers and delivery riders",
            "It charges the customer an extra ₹50 OTP fee",
            "It plays a congratulatory tune on the rider's phone"
        ],
        correctOptionIndex: 1,
        category: "ITZO Platform Knowledge",
        difficulty: "Medium"
    }
];

async function seedQuestionBank() {
    try {
        const uri = process.env.MONGODB_URI;
        if (!uri) {
            throw new Error("MONGODB_URI not found in .env file");
        }

        console.log("Connecting to MongoDB...");
        await mongoose.connect(uri);
        console.log("Connected successfully to MongoDB.");

        console.log("Clearing existing assessment questions to ensure a clean bank of 100 real questions...");
        await AssessmentQuestion.deleteMany({});
        console.log("Cleared old questions.");

        // Try to find an admin to attach as createdBy
        const FoodAdmin = mongoose.models.FoodAdmin || mongoose.model('FoodAdmin', new mongoose.Schema({ name: String }, { strict: false }), 'food_admins');
        const admin = await FoodAdmin.findOne();
        const adminId = admin ? admin._id : undefined;

        console.log(`Inserting exactly ${questionsData.length} real MCQ questions across 5 categories...`);
        
        const preparedQuestions = questionsData.map(q => ({
            ...q,
            createdBy: adminId,
            isActive: true
        }));

        await AssessmentQuestion.insertMany(preparedQuestions);

        console.log("==================================================");
        console.log(`SUCCESS! Inserted exactly ${preparedQuestions.length} real MCQ questions!`);
        console.log("Categories seeded:");
        const categories = [...new Set(preparedQuestions.map(q => q.category))];
        categories.forEach(cat => {
            const count = preparedQuestions.filter(q => q.category === cat).length;
            console.log(` - ${cat}: ${count} questions`);
        });
        console.log("==================================================");

        await mongoose.disconnect();
        console.log("Disconnected from MongoDB.");
        process.exit(0);
    } catch (error) {
        console.error("Error seeding question bank:", error);
        process.exit(1);
    }
}

seedQuestionBank();
