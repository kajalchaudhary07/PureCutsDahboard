/**
 * Image Resolution Requirements Guide
 * Defines optimal and minimum resolutions for different image types across PureCuts platform
 */

export const IMAGE_RESOLUTIONS = {
  // Product images
  product: {
    type: "Product Images",
    description: "Main product photos for listing and detail pages",
    optimal: { width: 1200, height: 1200 },
    minimum: { width: 500, height: 500 },
    aspectRatio: "1:1 (Square)",
    maxFileSize: "5MB",
    formats: ["JPEG", "PNG", "WebP"],
    notes: "High quality photo with clear background. Higher resolution recommended for zoom feature.",
  },

  // Banner images
  banner: {
    type: "Banner Images",
    description: "Hero banners and promotional images on homepage/category pages",
    optimal: { width: 1920, height: 1080 },
    minimum: { width: 1280, height: 720 },
    aspectRatio: "16:9 (Widescreen)",
    maxFileSize: "10MB",
    formats: ["JPEG", "PNG", "WebP"],
    notes: "Supports video format (MP4, WebM). Ensure text is readable on mobile.",
  },

  // Category thumbnail
  category: {
    type: "Category Thumbnail",
    description: "Category icons and thumbnails shown in category listing",
    optimal: { width: 500, height: 500 },
    minimum: { width: 300, height: 300 },
    aspectRatio: "1:1 (Square)",
    maxFileSize: "2MB",
    formats: ["JPEG", "PNG", "WebP"],
    notes: "Should have clear subject. Transparent background (PNG) recommended.",
  },

  // Subcategory thumbnail
  subcategory: {
    type: "Subcategory Thumbnail",
    description: "Subcategory images for nested category navigation",
    optimal: { width: 400, height: 400 },
    minimum: { width: 250, height: 250 },
    aspectRatio: "1:1 (Square)",
    maxFileSize: "2MB",
    formats: ["JPEG", "PNG", "WebP"],
    notes: "Consistent with category styling. Good contrast recommended.",
  },

  // Brand logo
  brand: {
    type: "Brand Logo",
    description: "Brand/company logos and marks",
    optimal: { width: 600, height: 400 },
    minimum: { width: 200, height: 200 },
    aspectRatio: "3:2 or 1:1",
    maxFileSize: "1MB",
    formats: ["JPEG", "PNG", "WebP", "SVG"],
    notes: "Should scale well at smaller sizes. Vector format (SVG) is ideal.",
  },

  // Review image
  review: {
    type: "User Review Image",
    description: "Customer photos attached to product reviews",
    optimal: { width: 1000, height: 1000 },
    minimum: { width: 400, height: 400 },
    aspectRatio: "1:1 or Any",
    maxFileSize: "8MB",
    formats: ["JPEG", "PNG", "WebP"],
    notes: "Mobile uploads are auto-resized. Ensure subject is clearly visible.",
  },
};

/**
 * Get resolution info for a specific image type
 * @param {string} imageType - Type of image (e.g., 'product', 'banner')
 * @returns {object} Resolution information for that type
 */
export const getResolutionInfo = (imageType) => {
  return IMAGE_RESOLUTIONS[imageType.toLowerCase()] || null;
};

/**
 * Get all image types available
 * @returns {array} Array of available image types
 */
export const getAllImageTypes = () => {
  return Object.keys(IMAGE_RESOLUTIONS);
};

/**
 * Format resolution as readable text
 * @param {object} resolution - Resolution object with width and height
 * @returns {string} Formatted resolution string
 */
export const formatResolution = (resolution) => {
  if (!resolution?.width || !resolution?.height) return "N/A";
  return `${resolution.width} × ${resolution.height}px`;
};

/**
 * Check if image meets minimum resolution requirements
 * @param {number} width - Image width in pixels
 * @param {number} height - Image height in pixels
 * @param {string} imageType - Type of image
 * @returns {object} Validation result with status and message
 */
export const validateImageResolution = (width, height, imageType) => {
  const info = getResolutionInfo(imageType);

  if (!info) {
    return {
      valid: false,
      message: `Unknown image type: ${imageType}`,
      status: "error",
    };
  }

  const { minimum, optimal } = info;

  if (width < minimum.width || height < minimum.height) {
    return {
      valid: false,
      message: `Resolution too low. Minimum: ${formatResolution(minimum)}, Provided: ${width}×${height}px`,
      status: "error",
    };
  }

  if (width < optimal.width || height < optimal.height) {
    return {
      valid: true,
      message: `Resolution acceptable but below optimal. Optimal: ${formatResolution(optimal)}, Provided: ${width}×${height}px`,
      status: "warning",
    };
  }

  return {
    valid: true,
    message: `Resolution meets optimal requirements: ${formatResolution({ width, height })}`,
    status: "success",
  };
};

/**
 * Generate a summary card info for display
 * @param {string} imageType - Type of image
 * @returns {object} Formatted info suitable for UI display
 */
export const generateResolutionCard = (imageType) => {
  const info = getResolutionInfo(imageType);
  if (!info) return null;

  return {
    title: info.type,
    description: info.description,
    specs: [
      { label: "Optimal Size", value: formatResolution(info.optimal) },
      { label: "Minimum Size", value: formatResolution(info.minimum) },
      { label: "Aspect Ratio", value: info.aspectRatio },
      { label: "Max File Size", value: info.maxFileSize },
      { label: "Formats", value: info.formats.join(", ") },
    ],
    notes: info.notes,
  };
};

/**
 * Get quick reference table for all image types
 * @returns {array} Array of image types with basic info
 */
export const getQuickReference = () => {
  return Object.entries(IMAGE_RESOLUTIONS).map(([key, value]) => ({
    type: key,
    name: value.type,
    optimal: formatResolution(value.optimal),
    minimum: formatResolution(value.minimum),
    aspectRatio: value.aspectRatio,
  }));
};
