export const CHAT_COPY = {
  startPrompt: "Type any message to begin. Example: hii",
  welcome: "स्वागत\nWelcome to PureCuts Bulk Support\nHow can we help you today?",
  askProductType: "What type of products?",
  askQuantity: "What quantity range are you planning for this order?",
  nextAction: "What would you like to do next?",
  chooseAvailableOption: "Please choose one of the available options shown in chat.",
};

export const TOP_LEVEL_OPTIONS = [
  { id: "bulk-order-discount", label: "Bulk Order Discount" },
  { id: "product-availability", label: "Product Availability" },
  { id: "delivery-info", label: "Delivery Info" },
  { id: "talk-to-sales", label: "Talk to Sales" },
];

export const PRODUCT_TYPE_OPTIONS = [
  { id: "skincare", label: "Skincare" },
  { id: "hair", label: "Hair" },
  { id: "equipment", label: "Equipment" },
  { id: "mixed", label: "Mixed" },
];

export const QUANTITY_OPTIONS = [
  { id: "5-10", label: "5-10" },
  { id: "10-25", label: "10-25" },
  { id: "25-50", label: "25-50" },
  { id: "50+", label: "50+" },
];

export const DISCOUNT_RULES = {
  "5-10": {
    discount: 5,
    suggestion: "Add a few more items to unlock an 8% discount tier.",
    suggestTalkToSales: false,
  },
  "10-25": {
    discount: 8,
    suggestion: "Increase your order toward 25+ units to unlock a 12% discount.",
    suggestTalkToSales: false,
  },
  "25-50": {
    discount: 12,
    suggestion: "For the best value, consider moving into the 50+ slab for 15%.",
    suggestTalkToSales: false,
  },
  "50+": {
    discount: 15,
    suggestion: "Great volume. A sales specialist can help you with a custom deal.",
    suggestTalkToSales: true,
  },
};

export const SUPPORT_RESPONSES = {
  "product-availability": "Please choose a product category and we will confirm stock with priority handling.",
  "delivery-info": "Bulk orders usually ship within 2-5 business days based on location and stock.",
  "talk-to-sales": "Perfect. Click Talk to Sales below and our team will contact you shortly.",
};

export const FINAL_ACTIONS = [
  { id: "talk-to-sales", label: "Talk to Sales", variant: "primary" },
  { id: "place-order", label: "Place Order", variant: "outline" },
];
