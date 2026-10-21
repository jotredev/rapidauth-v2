import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");

const passwordConfirmationSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

const termsAcceptanceField = z.boolean().refine((value) => value === true, {
  message: "You must accept the terms and conditions",
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptTerms: termsAcceptanceField,
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const resetPasswordSchema = passwordConfirmationSchema;

export const resetPasswordWithCodeSchema = z
  .object({
    email: z.string().trim().email("Invalid email address"),
    code: z
      .string()
      .trim()
      .length(6, "Verification code must be 6 digits")
      .regex(/^\d{6}$/, "Code must contain only digits"),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Password is required"),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export const acceptInviteSchema = passwordConfirmationSchema.and(
  z.object({ acceptTerms: termsAcceptanceField }),
);

export const twoFactorSchema = z.object({
  code: z.string().length(6, "Code must be 6 digits"),
});

export const backupCodeSchema = z.object({
  code: z.string().min(1, "Backup code is required"),
});

export const passwordConfirmSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

export const acceptTermsSchema = z.object({ acceptTerms: termsAcceptanceField });

export const verifyTotpSetupSchema = z.object({
  code: z.string().length(6, "Code must be 6 digits"),
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
export type ResetPasswordWithCodeFormData = z.infer<
  typeof resetPasswordWithCodeSchema
>;
export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;
export type AcceptInviteFormData = z.infer<typeof acceptInviteSchema>;
export type TwoFactorFormData = z.infer<typeof twoFactorSchema>;
export type BackupCodeFormData = z.infer<typeof backupCodeSchema>;
export type PasswordConfirmFormData = z.infer<typeof passwordConfirmSchema>;
export type AcceptTermsFormData = z.infer<typeof acceptTermsSchema>;
export type VerifyTotpSetupFormData = z.infer<typeof verifyTotpSetupSchema>;
