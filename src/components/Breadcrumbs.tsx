import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

const Breadcrumbs = ({ items }: { items: BreadcrumbItem[] }) => (
  <nav className="flex items-center gap-1.5 mb-6 text-[13px] font-body">
    {items.map((item, i) => (
      <span key={i} className="flex items-center gap-1.5">
        {i > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
        {item.href ? (
          <Link to={item.href} className="text-muted-foreground hover:text-foreground transition-colors">
            {item.label}
          </Link>
        ) : (
          <span className="text-foreground">{item.label}</span>
        )}
      </span>
    ))}
  </nav>
);

export default Breadcrumbs;
