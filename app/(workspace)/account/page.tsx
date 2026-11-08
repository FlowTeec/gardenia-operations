import type { Metadata } from "next";

import { AccountSettings } from "@/components/account-settings";

export const metadata: Metadata = { title: "Account" };

export const instant = false;

export default function AccountPage() {
  return <AccountSettings />;
}
