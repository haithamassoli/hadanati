"use client";

// Shared TanStack Form setup (@tanstack/react-form + zod). One `useAppForm`
// with pre-bound field components so every form across the app validates,
// wires state and renders errors identically. Zod schemas are Standard Schema,
// so they drop straight into `validators: { onChange: schema }`.
//
// Fields validate on change; errors only exist after an edit or a submit
// attempt (no onMount validator), so `<FieldErrors>` can render unconditionally
// without flashing on a pristine form.

import type { ComponentProps, ReactNode } from "react";
import {
  createFormHook,
  createFormHookContexts,
  type AnyFieldApi,
} from "@tanstack/react-form";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

export const { fieldContext, formContext, useFieldContext, useFormContext } =
  createFormHookContexts();

/**
 * First validation message for a field, or null. Takes the field as a prop so
 * it works both inside the bound components and in custom `form.Field` renders
 * (guardians, password toggle, checkbox lists, …).
 */
export function FieldErrors({ field }: { field: AnyFieldApi }) {
  const [issue] = field.state.meta.errors;
  if (issue == null) return null;
  // Standard Schema (zod) issues are objects with `message`; tolerate strings.
  const message = typeof issue === "string" ? issue : (issue.message ?? "");
  if (message === "") return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}

function TextField({
  label,
  id,
  className,
  containerClassName,
  ...props
}: Omit<ComponentProps<typeof Input>, "value" | "onChange" | "onBlur"> & {
  label?: ReactNode;
  containerClassName?: string;
}) {
  const field = useFieldContext<string>();
  const invalid = field.state.meta.errors.length > 0;
  return (
    <div className={cn("flex flex-col gap-2", containerClassName)}>
      {label != null && <Label htmlFor={id ?? field.name}>{label}</Label>}
      <Input
        {...props}
        id={id ?? field.name}
        name={field.name}
        value={field.state.value ?? ""}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
        aria-invalid={invalid || undefined}
        className={className}
      />
      <FieldErrors field={field} />
    </div>
  );
}

function TextareaField({
  label,
  id,
  className,
  containerClassName,
  ...props
}: Omit<ComponentProps<typeof Textarea>, "value" | "onChange" | "onBlur"> & {
  label?: ReactNode;
  containerClassName?: string;
}) {
  const field = useFieldContext<string>();
  const invalid = field.state.meta.errors.length > 0;
  return (
    <div className={cn("flex flex-col gap-2", containerClassName)}>
      {label != null && <Label htmlFor={id ?? field.name}>{label}</Label>}
      <Textarea
        {...props}
        id={id ?? field.name}
        name={field.name}
        value={field.state.value ?? ""}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
        aria-invalid={invalid || undefined}
        className={className}
      />
      <FieldErrors field={field} />
    </div>
  );
}

function SelectField({
  label,
  placeholder,
  ariaLabel,
  options,
  children,
  size,
  triggerClassName,
  containerClassName,
}: {
  label?: ReactNode;
  placeholder?: string;
  ariaLabel?: string;
  options?: { value: string; label: ReactNode }[];
  children?: ReactNode;
  size?: "sm" | "default";
  triggerClassName?: string;
  containerClassName?: string;
}) {
  const field = useFieldContext<string>();
  const invalid = field.state.meta.errors.length > 0;
  return (
    <div className={cn("flex flex-col gap-2", containerClassName)}>
      {label != null && <Label>{label}</Label>}
      <Select
        value={field.state.value}
        onValueChange={(value) => field.handleChange(value)}
      >
        <SelectTrigger
          size={size}
          aria-label={ariaLabel}
          aria-invalid={invalid || undefined}
          className={cn("w-full", triggerClassName)}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options
            ? options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))
            : children}
        </SelectContent>
      </Select>
      <FieldErrors field={field} />
    </div>
  );
}

/** Submit button that shows a spinner while the form is submitting. */
function SubmitButton({
  children,
  disabled,
  ...props
}: ComponentProps<typeof Button>) {
  const form = useFormContext();
  return (
    <form.Subscribe selector={(state) => state.isSubmitting}>
      {(isSubmitting) => (
        <Button type="submit" disabled={disabled || isSubmitting} {...props}>
          {isSubmitting && <Spinner data-icon="inline-start" />}
          {children}
        </Button>
      )}
    </form.Subscribe>
  );
}

export const { useAppForm, withForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: { TextField, TextareaField, SelectField },
  formComponents: { SubmitButton },
});
