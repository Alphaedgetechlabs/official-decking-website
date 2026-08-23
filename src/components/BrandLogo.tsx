import arrowAsset from "@/assets/arrow_new.webp.asset.json";

interface BrandLogoProps {
  variant?: "light" | "dark";
  className?: string;
  /** Font size of the wordmark, e.g. "26px" or "30px" */
  fontSize?: string;
  /** Hide the arrow icon (useful in compact footer placements). */
  showArrow?: boolean;
}

/**
 * QuoteMyDecking wordmark + optional arrow lockup.
 * Montserrat: "Quote" 700 #FF6A1C, "My" 500 #666666, "Decking" 700 #333333.
 * Arrow uses the original asset, height 1.08em, width auto, 0.5cm left gap.
 */
const BrandLogo = ({ variant = "dark", className = "", fontSize, showArrow = true }: BrandLogoProps) => {
  const isLight = variant === "light";

  return (
    <span
      className={`inline-flex items-center leading-none ${className}`}
      style={{
        fontFamily: "Montserrat, Poppins, ui-sans-serif, system-ui, sans-serif",
        fontSize,
      }}
    >
      <span className="flex items-baseline tracking-tight">
        <span style={{ color: "#FF6A1C", fontWeight: 700 }}>Quote</span>
        <span
          style={{
            color: isLight ? "#D6D6D6" : "#666666",
            fontWeight: 500,
            fontSize: "1em",
            transform: "translateY(0.03em)",
          }}
        >
          My
        </span>
        <span style={{ color: isLight ? "#FFFFFF" : "#333333", fontWeight: 700 }}>Decking</span>
      </span>
      {showArrow && (
        <img
          src={arrowAsset.url}
          alt=""
          aria-hidden="true"
          className="ml-[0.5cm] h-[1.08em] w-auto"
        />
      )}
    </span>
  );
};

export default BrandLogo;
