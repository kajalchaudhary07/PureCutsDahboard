/**
 * Image Resolution Utility - Usage Guide
 * 
 * This file demonstrates how to use the image resolution utilities
 * in your admin pages and components.
 */

// Import the utilities
import {
  IMAGE_RESOLUTIONS,
  getResolutionInfo,
  getAllImageTypes,
  formatResolution,
  validateImageResolution,
  generateResolutionCard,
  getQuickReference,
} from "../../utils/imageResolutions";

// ============================================================================
// EXAMPLE 1: Get resolution info for a specific image type
// ============================================================================

const productResolutions = getResolutionInfo("product");
console.log(productResolutions);
/* Output:
{
  type: "Product Images",
  description: "Main product photos for listing and detail pages",
  optimal: { width: 1200, height: 1200 },
  minimum: { width: 500, height: 500 },
  aspectRatio: "1:1 (Square)",
  maxFileSize: "5MB",
  formats: ["JPEG", "PNG", "WebP"],
  notes: "..."
}
*/

// ============================================================================
// EXAMPLE 2: Validate image resolution when user uploads
// ============================================================================

const handleImageUpload = (file, imageType) => {
  // Create an Image object to get dimensions
  const img = new Image();
  img.onload = () => {
    const result = validateImageResolution(img.width, img.height, imageType);
    
    if (result.valid) {
      console.log(result.message); // "Resolution meets optimal requirements..."
      // Process upload
    } else if (result.status === "warning") {
      console.warn(result.message); // "Resolution acceptable but below optimal..."
      // Show warning but allow upload
    } else {
      console.error(result.message); // "Resolution too low..."
      // Reject upload
    }
  };
  img.src = URL.createObjectURL(file);
};

// ============================================================================
// EXAMPLE 3: Display resolution requirements in a form
// ============================================================================

const ProductUploadForm = () => {
  const productResInfo = generateResolutionCard("product");
  
  return (
    <div>
      <h3>{productResInfo.title}</h3>
      <p>{productResInfo.description}</p>
      
      <div className="requirements">
        {productResInfo.specs.map((spec) => (
          <div key={spec.label}>
            <strong>{spec.label}:</strong> {spec.value}
          </div>
        ))}
      </div>
      
      <div className="notes">
        <strong>Note:</strong> {productResInfo.notes}
      </div>
    </div>
  );
};

// ============================================================================
// EXAMPLE 4: Get all available image types
// ============================================================================

const imageTypes = getAllImageTypes();
console.log(imageTypes); // ["product", "banner", "category", "subcategory", "brand", "review"]

// ============================================================================
// EXAMPLE 5: Format resolution for display
// ============================================================================

const optimal = getResolutionInfo("banner").optimal;
const formatted = formatResolution(optimal);
console.log(formatted); // "1920 × 1080px"

// ============================================================================
// EXAMPLE 6: Use quick reference in a dropdown/list
// ============================================================================

const ResolutionSelector = () => {
  const quickRef = getQuickReference();
  
  return (
    <select onChange={(e) => console.log(e.target.value)}>
      <option>Select image type...</option>
      {quickRef.map((item) => (
        <option key={item.type} value={item.type}>
          {item.name} ({item.optimal})
        </option>
      ))}
    </select>
  );
};

// ============================================================================
// EXAMPLE 7: Real-world usage in a Product Upload Component
// ============================================================================

const ProductImageUpload = ({ onImageChange }) => {
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);
  const resInfo = generateResolutionCard("product");

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const img = new Image();
    img.onload = () => {
      const validation = validateImageResolution(img.width, img.height, "product");
      
      if (validation.status === "error") {
        setError(validation.message);
        setWarning(null);
        return;
      }

      if (validation.status === "warning") {
        setWarning(validation.message);
        setError(null);
      } else {
        setWarning(null);
        setError(null);
      }

      onImageChange(file);
    };

    img.src = URL.createObjectURL(file);
  };

  return (
    <div className="form-group">
      <label>Product Image</label>
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="form-control"
      />
      
      {/* Display requirements */}
      <div className="small text-muted">
        Optimal: <strong>{resInfo.specs[0].value}</strong> | 
        Minimum: <strong>{resInfo.specs[1].value}</strong>
      </div>

      {/* Show validation messages */}
      {error && <div className="alert alert-danger">{error}</div>}
      {warning && <div className="alert alert-warning">{warning}</div>}
    </div>
  );
};

// ============================================================================
// EXAMPLE 8: Accessing raw configuration
// ============================================================================

// All resolution data is available in IMAGE_RESOLUTIONS object
Object.entries(IMAGE_RESOLUTIONS).forEach(([type, info]) => {
  console.log(`${type}: ${formatResolution(info.optimal)}`);
});

/* Output:
product: 1200 × 1200px
banner: 1920 × 1080px
category: 500 × 500px
subcategory: 400 × 400px
brand: 600 × 400px
review: 1000 × 1000px
*/

// ============================================================================
// EXAMPLE 9: Helper function to check if image matches aspect ratio
// ============================================================================

const checkAspectRatio = (width, height, imageType) => {
  const info = getResolutionInfo(imageType);
  const optimal = info.optimal;
  
  const optimalRatio = optimal.width / optimal.height;
  const actualRatio = width / height;
  
  // Allow 5% tolerance
  return Math.abs(optimalRatio - actualRatio) / optimalRatio < 0.05;
};

// Usage:
console.log(checkAspectRatio(1200, 1200, "product")); // true (1:1 ratio)
console.log(checkAspectRatio(1920, 1080, "banner"));  // true (16:9 ratio)
console.log(checkAspectRatio(1000, 1000, "banner"));  // false (not 16:9 ratio)

// ============================================================================
// EXAMPLE 10: Create a validation report for batch uploads
// ============================================================================

const validateBatchImages = async (files, imageType) => {
  const results = [];

  for (const file of files) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const validation = validateImageResolution(
          img.width,
          img.height,
          imageType
        );
        results.push({
          fileName: file.name,
          dimensions: `${img.width}×${img.height}`,
          status: validation.status,
          message: validation.message,
        });
        resolve(results);
      };
      img.src = URL.createObjectURL(file);
    });
  }

  return results;
};

// ============================================================================
// Integration Tips
// ============================================================================

/*
1. PRODUCT UPLOADS
   - Add validateImageResolution() to product add/edit forms
   - Show resolution requirements near file input
   - Warn if image is below optimal (but allow if above minimum)

2. BANNER MANAGEMENT
   - Validate 16:9 aspect ratio strictly
   - Show dimension preview before save
   - Consider video support (MP4, WebM)

3. CATEGORY/SUBCATEGORY IMAGES
   - Enforce 1:1 aspect ratio
   - Show recommended toolbar dimension reminders
   - Support PNG for transparency

4. BULK OPERATIONS
   - Use validateBatchImages() for multiple uploads
   - Generate report showing pass/fail status
   - Allow selective re-upload of failed items

5. USER REVIEWS
   - More lenient on exact dimensions (accept any aspect ratio)
   - Focus on minimum quality (500×500 minimum)
   - Auto-resize large uploads

6. ADMIN MESSAGE
   - Show resolution guide in onboarding
   - Link to /image-guide for detailed instructions
   - Provide download links for recommended tools
*/

export default null; // This is just documentation
