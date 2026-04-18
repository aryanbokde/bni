"use client";

import UserMenu from "./UserMenu";

export default function TopBar() {
  return (
    <header className="topbar hidden lg:flex fixed top-0 right-0 z-20 h-16 bg-white/90 backdrop-blur-md border-b border-slate-200 items-center justify-end px-6 transition-all duration-normal">
      <UserMenu variant="light" showDetails={true} />
    </header>
  );
}
