import { SiteHeader } from "@/components/site-header";
import { SubmitForm } from "@/components/submit-form";

export default function SubmitPage() {
  return <div className="site-page interior"><SiteHeader active="submit" /><main className="shell submit-page"><SubmitForm /></main></div>;
}
