// 管理者（ADMIN_EMAILS にカンマ区切りで入れたメールの人）。部屋ページで人が足した家具を、だれのものでも消せる
export const isAdmin = (email: string | null | undefined) =>
  !!email &&
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .includes(email.toLowerCase())
