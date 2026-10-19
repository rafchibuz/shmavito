import { ProfileDashboard } from "@/components/profile-dashboard";
import { SiteHeader } from "@/components/site-header";

export default function ProfilePage() {
  return <div className="site-page interior"><SiteHeader active="profile" /><ProfileDashboard /></div>;
}
