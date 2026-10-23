"use client";

import * as React from "react";
import type { UseFormReturn } from "react-hook-form";
import { User, Mail, Lock, Eye, EyeOff } from "lucide-react";

import type { RegisterFormData } from "@/validations/auth";

import { AuthLink } from "./auth-card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";

/** Name, email, password, confirmation and terms fields shared by the register and first-run admin forms. */
export function RegisterFields({
  form,
  disabled,
}: {
  form: UseFormReturn<RegisterFormData>;
  disabled: boolean;
}) {
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  return (
    <>
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Full Name</FormLabel>
            <FormControl>
              <div className="relative">
                <User
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                  strokeWidth={1.5}
                />
                <Input
                  type="text"
                  placeholder="John Doe"
                  className="pl-10"
                  disabled={disabled}
                  {...field}
                />
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="email"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl>
              <div className="relative">
                <Mail
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                  strokeWidth={1.5}
                />
                <Input
                  type="email"
                  placeholder="name@example.com"
                  className="pl-10"
                  disabled={disabled}
                  {...field}
                />
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="password"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Password</FormLabel>
            <FormControl>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                  strokeWidth={1.5}
                />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password"
                  className="pl-10 pr-10"
                  disabled={disabled}
                  {...field}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" strokeWidth={1.5} />
                  ) : (
                    <Eye className="h-4 w-4" strokeWidth={1.5} />
                  )}
                </button>
              </div>
            </FormControl>
            <FormDescription>
              Must be at least 8 characters with uppercase and number
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="confirmPassword"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Confirm Password</FormLabel>
            <FormControl>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                  strokeWidth={1.5}
                />
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your password"
                  className="pl-10 pr-10"
                  disabled={disabled}
                  {...field}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" strokeWidth={1.5} />
                  ) : (
                    <Eye className="h-4 w-4" strokeWidth={1.5} />
                  )}
                </button>
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="acceptTerms"
        render={({ field }) => (
          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
            <FormControl>
              <Checkbox
                className="dark:border-foreground/60"
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={disabled}
              />
            </FormControl>
            <div className="space-y-1 leading-none">
              <FormLabel className="inline cursor-pointer gap-0 text-sm font-normal">
                I agree to the{" "}
                <AuthLink href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</AuthLink>{" "}and{" "}
                <AuthLink href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</AuthLink>
              </FormLabel>
              <FormMessage />
            </div>
          </FormItem>
        )}
      />
    </>
  );
}
