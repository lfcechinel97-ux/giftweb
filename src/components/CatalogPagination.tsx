import { ChevronLeft, ChevronRight } from "lucide-react";

interface CatalogPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const CatalogPagination = ({ currentPage, totalPages, onPageChange }: CatalogPaginationProps) => {
  if (totalPages <= 1) return null;

  const pages: (number | string)[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "...") {
      pages.push("...");
    }
  }

  const handleClick = (page: number) => {
    onPageChange(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="flex items-center justify-center gap-1 mt-8">
      <button
        disabled={currentPage === 1}
        onClick={() => handleClick(currentPage - 1)}
        className="p-2 rounded-lg border border-border text-muted-foreground hover:border-green-cta hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      {pages.map((p, i) =>
        typeof p === "string" ? (
          <span key={i} className="px-2 text-muted-foreground text-sm">…</span>
        ) : (
          <button
            key={i}
            onClick={() => handleClick(p)}
            className={`w-9 h-9 rounded-lg text-sm font-semibold transition-colors ${
              p === currentPage
                ? "bg-green-cta text-primary-foreground"
                : "border border-border text-muted-foreground hover:border-green-cta hover:text-foreground"
            }`}
          >
            {p}
          </button>
        )
      )}
      <button
        disabled={currentPage === totalPages}
        onClick={() => handleClick(currentPage + 1)}
        className="p-2 rounded-lg border border-border text-muted-foreground hover:border-green-cta hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
};

export default CatalogPagination;
