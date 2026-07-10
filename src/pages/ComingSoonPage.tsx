import { PageHero } from "@/components/layout/PageHero";

export default function ComingSoonPage({
  title,
  icon,
  tagline,
}: {
  title: string;
  icon: string;
  tagline?: string;
}) {
  return (
    <PageHero
      label={title.toUpperCase()}
      value="Coming soon"
      description={tagline ?? `${title} is on the way — check back soon.`}
      icon={icon}
    />
  );
}
