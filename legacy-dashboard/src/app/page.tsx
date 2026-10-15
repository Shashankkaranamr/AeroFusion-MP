import { HomePage } from "@/components/landing/home";
import { LandingNav } from "@/components/landing/landing-nav";
import { CommandMenu } from "@/components/layout/command-menu";

export default function Home() {
  return (
    <>
      <LandingNav />
      <HomePage />
      <CommandMenu />
    </>
  );
}
