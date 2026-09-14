import { Label } from "@food/components/ui/label";
import { cn } from "@food/utils/utils";

/**
 * The ONE form system for the admin panel (Vehicles, Goods Types, Pricing,
 * Zones, Settings, …). Composes the existing Label/Input/Select/Textarea
 * primitives — these components only handle layout, spacing and validation
 * presentation so every form looks identical.
 */

/** Form shell with optional sticky footer actions. */
export function FormLayout({ onSubmit, children, actions, stickyActions = true, className }) {
  return (
    <form
      onSubmit={onSubmit}
      className={cn("flex min-h-0 flex-col", className)}
    >
      <div className="space-y-6">{children}</div>
      {actions && (
        <div
          className={cn(
            "mt-6 flex flex-wrap items-center justify-end gap-2.5 border-t border-border bg-card px-1 py-4",
            stickyActions && "sticky bottom-0 z-10"
          )}
        >
          {actions}
        </div>
      )}
    </form>
  );
}

/** Titled group of fields, rendered on the shared card surface. */
export function FormSection({ title, description, children, className }) {
  return (
    <section className={cn("blaze-card p-5", className)}>
      {(title || description) && (
        <div className="mb-4 space-y-0.5">
          {title && <h3 className="blaze-section-title">{title}</h3>}
          {description && <p className="blaze-section-subtitle">{description}</p>}
        </div>
      )}
      <div className="space-y-4">{children}</div>
    </section>
  );
}

/** Responsive field grid (1 col mobile → N cols desktop). */
export function FormRow({ cols = 2, children, className }) {
  const colClass =
    cols === 3
      ? "sm:grid-cols-2 lg:grid-cols-3"
      : cols === 1
        ? "grid-cols-1"
        : "sm:grid-cols-2";
  return <div className={cn("grid gap-4", colClass, className)}>{children}</div>;
}

/** Label + control + hint/error wrapper. Pass the input/select/textarea as children. */
export function FormField({ label, htmlFor, required, hint, error, children, className }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <Label htmlFor={htmlFor} className="blaze-label">
          {label}
          {required && <span className="text-[var(--blaze-danger)]">*</span>}
        </Label>
      )}
      {children}
      {error ? (
        <p className="text-xs font-medium text-[var(--blaze-danger)]">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export default FormLayout;
