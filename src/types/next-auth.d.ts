import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    role: "admin" | "viewer";
  }

  interface Session {
    user: {
      id: string;
      role: "admin" | "viewer";
    } & Session["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    role: "admin" | "viewer";
  }
}
