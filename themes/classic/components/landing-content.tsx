"use client";

import React, { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Link from "next/link";
import { signOut } from "@/actions/auth";
import { useMounted } from "@/hooks/use-mounted";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LayoutDashboard, UserCircle, LogOut, Sun, Moon } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

/* ─── Data ─── */
const FEATURES = [
  {
    num: "01",
    title: "Email & Password",
    desc: "Secure authentication with bcrypt hashing, email verification, and password reset flows — production-ready from day one.",
  },
  {
    num: "02",
    title: "OAuth Providers",
    desc: "One-click social login with Google, GitHub, and any provider. Extensible architecture for custom integrations.",
  },
  {
    num: "03",
    title: "Two-Factor Auth",
    desc: "TOTP-based 2FA with QR code setup, backup codes, and a seamless verification experience your users will trust.",
  },
  {
    num: "04",
    title: "Session Management",
    desc: "Secure session handling with device fingerprinting, IP tracking, and instant remote revocation capabilities.",
  },
  {
    num: "05",
    title: "Role-Based Access",
    desc: "Fine-grained permissions with admin and user roles. Protect routes, actions, and data at every level.",
  },
];

const STATS = [
  { value: 5, suffix: "", label: "Minute Setup" },
  { value: 99.9, suffix: "%", label: "Uptime SLA" },
  { value: 50, suffix: "k+", label: "Requests/sec" },
  { value: 0, suffix: "", label: "Dollars to Start" },
];

const TECH = [
  "Next.js 16",
  "React 19",
  "Better Auth",
  "Prisma",
  "Neon Postgres",
  "Stripe",
  "Resend",
  "shadcn/ui",
  "Tailwind v4",
  "TypeScript",
  "Zod",
  "GSAP",
];

const MARQUEE_TEXT =
  "SECURE \u00B7 FAST \u00B7 SIMPLE \u00B7 MODERN \u00B7 OPEN SOURCE \u00B7 PRODUCTION-READY \u00B7 ";

interface LandingUser {
  name: string;
  email: string;
  image?: string;
}

/* ─── Component ─── */
export function LandingContent({ user }: { user?: LandingUser | null }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const cursorDotRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = React.useState(false);
  const mounted = useMounted();

  /* ─── Scroll detection ─── */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* ─── Custom Cursor ─── */
  useEffect(() => {
    const cursor = cursorRef.current;
    const dot = cursorDotRef.current;
    if (!cursor || !dot) return;

    if ("ontouchstart" in window || window.innerWidth < 768) {
      cursor.style.display = "none";
      dot.style.display = "none";
      return;
    }

    let mouseX = 0;
    let mouseY = 0;
    let cursorX = 0;
    let cursorY = 0;

    const onMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      gsap.to(dot, { x: mouseX, y: mouseY, duration: 0.1, overwrite: true });
    };

    const ticker = () => {
      cursorX += (mouseX - cursorX) * 0.12;
      cursorY += (mouseY - cursorY) * 0.12;
      gsap.set(cursor, { x: cursorX, y: cursorY });
    };

    const onEnterInteractive = () => {
      gsap.to(cursor, { scale: 2.5, opacity: 0.4, duration: 0.4, ease: "power2.out" });
    };
    const onLeaveInteractive = () => {
      gsap.to(cursor, { scale: 1, opacity: 1, duration: 0.4, ease: "power2.out" });
    };

    window.addEventListener("mousemove", onMouseMove);
    gsap.ticker.add(ticker);

    const interactiveEls = document.querySelectorAll(
      "a, button, [data-hover]"
    );
    interactiveEls.forEach((el) => {
      el.addEventListener("mouseenter", onEnterInteractive);
      el.addEventListener("mouseleave", onLeaveInteractive);
    });

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      gsap.ticker.remove(ticker);
      interactiveEls.forEach((el) => {
        el.removeEventListener("mouseenter", onEnterInteractive);
        el.removeEventListener("mouseleave", onLeaveInteractive);
      });
    };
  }, []);

  /* ─── GSAP Animations ─── */
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(".loader", { yPercent: -100 });
      gsap.set(
        ".nav-item, .hero-line, .hero-sub, .hero-cta, .hero-line-deco, .scroll-indicator, .fade-in, .tech-item, .cta-text, .stat-number",
        { opacity: 1, y: 0, x: 0, scale: 1, clearProps: "all" }
      );
      return;
    }

    const ctx = gsap.context(() => {
      /* ═══ PAGE LOAD ═══ */
      const loadTl = gsap.timeline({ defaults: { ease: "power3.out" } });

      loadTl
        .to(".loader-text", {
          opacity: 1,
          duration: 0.4,
          ease: "power2.in",
        })
        .to(".loader-text", {
          letterSpacing: "0.5em",
          duration: 0.6,
          ease: "power2.inOut",
        })
        .to(
          ".loader-line",
          {
            scaleX: 1,
            duration: 0.8,
            ease: "power4.inOut",
          },
          "-=0.3"
        )
        .to(".loader", {
          yPercent: -100,
          duration: 1,
          ease: "power4.inOut",
        })
        .from(
          ".nav-item",
          {
            opacity: 0,
            y: -30,
            stagger: 0.06,
            duration: 0.7,
          },
          "-=0.5"
        )
        .from(
          ".hero-line",
          {
            yPercent: 130,
            rotationZ: 4,
            stagger: 0.15,
            duration: 1.2,
            ease: "power4.out",
          },
          "-=0.6"
        )
        .from(
          ".hero-line-deco",
          {
            scaleX: 0,
            duration: 1.4,
            ease: "power2.inOut",
          },
          "-=0.9"
        )
        .from(
          ".hero-sub",
          {
            opacity: 0,
            y: 40,
            duration: 0.9,
          },
          "-=0.7"
        )
        .from(
          ".hero-cta",
          {
            opacity: 0,
            y: 25,
            stagger: 0.12,
            duration: 0.7,
          },
          "-=0.5"
        )
        .from(
          ".scroll-indicator",
          {
            opacity: 0,
            y: -15,
            duration: 0.6,
          },
          "-=0.3"
        );

      /* ═══ MARQUEE PARALLAX ═══ */
      gsap.to(".marquee-track", {
        xPercent: -5,
        ease: "none",
        scrollTrigger: {
          trigger: ".marquee-section",
          start: "top bottom",
          end: "bottom top",
          scrub: 0.5,
        },
      });

      /* ═══ FEATURES HORIZONTAL SCROLL ═══ */
      const horizontalSection = document.querySelector(".horizontal-section");
      const cardsContainer = document.querySelector(
        ".cards-container"
      ) as HTMLElement;

      if (horizontalSection && cardsContainer && window.innerWidth >= 768) {
        const totalScroll =
          cardsContainer.scrollWidth - window.innerWidth + 100;

        gsap.to(cardsContainer, {
          x: -totalScroll,
          ease: "none",
          scrollTrigger: {
            trigger: horizontalSection,
            pin: true,
            scrub: 1,
            end: () => `+=${totalScroll}`,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        });
      } else {
        /* Mobile: stagger cards vertically */
        gsap.from(".feature-card", {
          opacity: 0,
          y: 60,
          stagger: 0.15,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: {
            trigger: ".horizontal-section",
            start: "top 80%",
          },
        });
      }

      /* ═══ FEATURE SECTION HEADER ═══ */
      gsap.from(".features-header", {
        opacity: 0,
        y: 60,
        duration: 1,
        ease: "power3.out",
        scrollTrigger: {
          trigger: ".features-header",
          start: "top 85%",
        },
      });

      /* ═══ STATS COUNTER ═══ */
      document.querySelectorAll(".stat-number").forEach((el) => {
        const target = parseFloat(el.getAttribute("data-value") || "0");
        const obj = { val: 0 };

        gsap.to(obj, {
          val: target,
          duration: 2.5,
          ease: "power2.out",
          scrollTrigger: {
            trigger: el,
            start: "top 85%",
          },
          onUpdate: () => {
            (el as HTMLElement).textContent =
              target % 1 !== 0
                ? obj.val.toFixed(1)
                : Math.round(obj.val).toString();
          },
        });
      });

      /* ═══ STATS FADE IN ═══ */
      gsap.from(".stat-item", {
        opacity: 0,
        y: 50,
        stagger: 0.1,
        duration: 0.8,
        ease: "power3.out",
        scrollTrigger: {
          trigger: ".stats-section",
          start: "top 80%",
        },
      });

      /* ═══ TECH GRID ═══ */
      gsap.from(".tech-item", {
        opacity: 0,
        y: 40,
        scale: 0.9,
        stagger: {
          each: 0.05,
          from: "random",
        },
        duration: 0.7,
        ease: "power3.out",
        scrollTrigger: {
          trigger: ".tech-grid",
          start: "top 80%",
        },
      });

      /* ═══ CTA SECTION ═══ */
      const ctaTl = gsap.timeline({
        scrollTrigger: {
          trigger: ".cta-section",
          start: "top 75%",
        },
      });

      ctaTl
        .from(".cta-text", {
          scale: 0.85,
          opacity: 0,
          y: 40,
          duration: 1.2,
          ease: "power3.out",
        })
        .from(
          ".cta-button",
          {
            opacity: 0,
            y: 30,
            duration: 0.8,
            ease: "power3.out",
          },
          "-=0.5"
        );

      /* ═══ PARALLAX ORBS ═══ */
      document.querySelectorAll("[data-speed]").forEach((el) => {
        const speed = parseFloat(el.getAttribute("data-speed") || "1");
        gsap.to(el, {
          y: () => speed * 150,
          ease: "none",
          scrollTrigger: {
            trigger: el,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        });
      });

      /* ═══ GENERAL FADE-IN ═══ */
      gsap.utils.toArray<HTMLElement>(".fade-in").forEach((el) => {
        gsap.from(el, {
          opacity: 0,
          y: 50,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: {
            trigger: el,
            start: "top 85%",
          },
        });
      });

      /* ═══ FOOTER REVEAL ═══ */
      gsap.from(".footer-content", {
        opacity: 0,
        y: 30,
        duration: 0.8,
        ease: "power3.out",
        scrollTrigger: {
          trigger: ".landing-footer",
          start: "top 90%",
        },
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative overflow-x-hidden bg-background text-foreground selection:bg-foreground selection:text-background"
    >
      {/* ─── Grain Overlay ─── */}
      <div
        className="pointer-events-none fixed inset-0 z-[9999] opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "256px 256px",
        }}
      />

      {/* ─── Custom Cursor ─── */}
      <div
        ref={cursorRef}
        className="pointer-events-none fixed -left-5 -top-5 z-[9998] hidden h-10 w-10 rounded-full border border-foreground/50 mix-blend-difference md:block"
      />
      <div
        ref={cursorDotRef}
        className="pointer-events-none fixed -left-[3px] -top-[3px] z-[9998] hidden h-1.5 w-1.5 rounded-full bg-foreground md:block"
      />

      {/* ─── Loader ─── */}
      <div className="loader fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background">
        <span
          className="loader-text opacity-0 font-normal text-2xl text-foreground sm:text-3xl"
        >
          RAPID
        </span>
        <div className="loader-line mt-4 h-px w-16 origin-left scale-x-0 bg-foreground/40" />
      </div>

      {/* ─── Navigation ─── */}
      <nav className={`fixed left-0 right-0 top-0 z-50 flex items-center justify-between px-6 py-4 sm:px-10 transition-all duration-300 ${scrolled ? "bg-background/90 backdrop-blur-md border-b border-border/60 py-3" : ""}`}>
        <Link
          href="/"
          className="nav-item font-normal text-lg text-foreground transition-opacity hover:opacity-70"
        >
          RAPID
        </Link>
        <div className="hidden items-center gap-8 md:flex">
          <a
            href="#features"
            className="nav-item text-sm tracking-wide text-muted-foreground transition-colors hover:text-foreground"
          >
            Features
          </a>
          <a
            href="#stack"
            className="nav-item text-sm tracking-wide text-muted-foreground transition-colors hover:text-foreground"
          >
            Stack
          </a>
          <a
            href="#pricing"
            className="nav-item text-sm tracking-wide text-muted-foreground transition-colors hover:text-foreground"
          >
            Pricing
          </a>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="nav-item text-muted-foreground transition-colors hover:text-foreground"
          >
            {mounted && resolvedTheme === "dark" ? (
              <Sun className="h-5 w-5" strokeWidth={1.5} />
            ) : (
              <Moon className="h-5 w-5" strokeWidth={1.5} />
            )}
          </button>
          {user ? (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger className="nav-item inline-flex items-center gap-2 text-sm tracking-wide text-foreground transition-colors hover:text-foreground outline-none cursor-pointer select-none">
                <Avatar className="h-8 w-8 border border-foreground/20">
                  <AvatarImage src={user.image} alt={user.name} />
                  <AvatarFallback className="bg-foreground/10 text-foreground text-xs">
                    {user.name.split(" ").map((n) => n[0]).join("")}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline">{user.name}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild className="gap-2 py-2.5">
                  <Link href="/dashboard">
                    <LayoutDashboard className="h-4 w-4" strokeWidth={1.5} />
                    Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="gap-2 py-2.5">
                  <Link href="/dashboard/profile">
                    <UserCircle className="h-4 w-4" strokeWidth={1.5} />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  className="gap-2 py-2.5"
                  onClick={async () => await signOut()}
                >
                  <LogOut className="h-4 w-4" strokeWidth={1.5} />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="nav-item text-sm tracking-wide text-muted-foreground transition-colors hover:text-foreground"
              >
                Sign In
              </Link>
              <Link
                href="/auth/register"
                className="nav-item border border-foreground/20 px-5 py-2 text-sm tracking-wide text-foreground transition-all hover:border-foreground/50 hover:bg-foreground/5"
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* ════════════════════════════════════════════
          HERO SECTION
      ════════════════════════════════════════════ */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-6 pt-20">
        {/* Hero content */}
        <div className="relative text-center">
          {/* Main text */}
          <div className="overflow-hidden">
            <h1 className="hero-line font-semibold tracking-tight text-[clamp(4rem,15vw,14rem)] leading-[0.85] text-foreground">
              RAPID
            </h1>
          </div>
          <div className="overflow-hidden mt-2">
            <p className="hero-line font-normal text-[clamp(1.8rem,5vw,5rem)] leading-[0.95] text-muted-foreground/80">
              auth
            </p>
          </div>

          {/* Decorative line */}
          <div className="hero-line-deco mx-auto my-8 h-px w-32 origin-left bg-gradient-to-r from-transparent via-foreground/30 to-transparent sm:w-48" />

          {/* Subtitle */}
          <p className="hero-sub mx-auto max-w-md text-base leading-relaxed text-muted-foreground sm:max-w-lg sm:text-lg">
            Production-ready authentication for the modern web.
            <br className="hidden sm:block" />
            Email, OAuth, 2FA, and sessions — everything you need to ship.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-5">
            <Link
              href="/auth/register"
              className="hero-cta group relative inline-flex items-center gap-2 rounded-md bg-foreground px-8 py-3.5 text-sm font-normal text-background transition-all hover:bg-foreground/90"
              data-hover
            >
              Start Building
              <svg
                className="h-4 w-4 transition-transform group-hover:translate-x-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
            </Link>
            <Link
              href="/dashboard"
              className="hero-cta inline-flex items-center gap-2 rounded-md border border-foreground/15 px-8 py-3.5 text-sm font-normal text-foreground/80 transition-all hover:border-foreground/30 hover:text-foreground"
              data-hover
            >
              View Demo
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="scroll-indicator absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Scroll
          </span>
          <div className="flex h-7 w-4 items-start justify-center rounded-full border border-muted-foreground/30 pt-1">
            <div className="h-1.5 w-0.5 animate-bounce rounded-full bg-foreground/60" />
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          MARQUEE SECTION
      ════════════════════════════════════════════ */}
      <section className="marquee-section relative overflow-hidden border-y border-border py-5 sm:py-6">
        <div
          className="marquee-track flex whitespace-nowrap"
          style={{ animation: "marquee 30s linear infinite" }}
        >
          {[...Array(4)].map((_, i) => (
            <span
              key={i}
              className="mx-0 text-sm font-normal tracking-[0.25em] text-muted-foreground/60 sm:text-base"
            >
              {MARQUEE_TEXT}
            </span>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════
          FEATURES — HORIZONTAL SCROLL
      ════════════════════════════════════════════ */}
      <section id="features" className="py-24 sm:py-32">
        <div className="features-header px-6 sm:px-10 mb-16 sm:mb-0">
          <p className="text-sm text-muted-foreground">
            What&apos;s Included
          </p>
          <h2 className="mt-3 font-semibold tracking-tight text-3xl sm:text-5xl leading-tight text-foreground">
            Everything you need.
            <br />
            <span className="text-muted-foreground/70">Nothing you don&apos;t.</span>
          </h2>
        </div>

        <div className="horizontal-section mt-10 sm:mt-20">
          <div className="flex h-auto flex-col gap-6 px-6 sm:h-screen sm:flex-row sm:items-center sm:gap-0 sm:px-0 md:h-screen">
            <div className="cards-container flex flex-col gap-6 sm:flex-row sm:gap-8 sm:pl-10 md:gap-10 md:pl-20">
              {FEATURES.map((f) => (
                <div
                  key={f.num}
                  className="feature-card group relative flex w-full flex-col justify-between border border-border bg-background p-6 transition-all duration-500 hover:border-accent hover:bg-card sm:w-[380px] sm:min-h-[420px] sm:p-8 md:w-[420px]"
                >
                  {/* Number */}
                  <div>
                    <span className="text-xs text-muted-foreground/50">
                      {f.num}
                    </span>
                    {/* Decorative corner */}
                    <div className="absolute right-6 top-6 h-3 w-3 border-r border-t border-muted-foreground/20 transition-all duration-500 group-hover:h-5 group-hover:w-5 group-hover:border-foreground/30" />
                  </div>

                  <div className="mt-auto pt-10 sm:pt-0">
                    <h3 className="font-semibold tracking-tight text-xl sm:text-2xl text-foreground mb-4">
                      {f.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {f.desc}
                    </p>
                  </div>

                  {/* Bottom line accent */}
                  <div className="absolute bottom-0 left-0 h-px w-0 bg-gradient-to-r from-foreground/60 to-transparent transition-all duration-700 group-hover:w-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          STATS
      ════════════════════════════════════════════ */}
      <section id="pricing" className="stats-section border-y border-border py-20 sm:py-28">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-10 px-6 sm:px-10 md:grid-cols-4 md:gap-6">
          {STATS.map((stat, i) => (
            <div key={i} className="stat-item text-center md:text-left">
              <div className="flex items-baseline justify-center gap-1 md:justify-start">
                <span
                  className="stat-number font-semibold tracking-tight text-5xl sm:text-6xl md:text-7xl text-foreground"
                  data-value={stat.value}
                >
                  0
                </span>
                {stat.suffix && (
                  <span className="font-semibold tracking-tight text-2xl sm:text-3xl text-muted-foreground">
                    {stat.suffix}
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════
          SHOWCASE — CODE PREVIEW
      ════════════════════════════════════════════ */}
      <section className="relative py-24 sm:py-32">
        <div className="mx-auto max-w-5xl px-6 sm:px-10">
          <div className="fade-in mb-12 sm:mb-16">
            <p className="text-sm text-muted-foreground">
              Developer Experience
            </p>
            <h2 className="mt-3 font-semibold tracking-tight text-3xl sm:text-5xl text-foreground">
              Ship in minutes.
            </h2>
          </div>

          {/* Code block */}
          <div className="fade-in relative overflow-hidden border border-border bg-background">
            {/* Tab bar */}
            <div className="flex items-center gap-0 border-b border-border px-4 py-2.5">
              <div className="flex gap-1.5 mr-6">
                <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
                <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
                <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
              </div>
              <span className="text-[11px] tracking-wider text-muted-foreground/60">
                auth.ts
              </span>
            </div>

            {/* Code content */}
            <pre className="overflow-x-auto p-6 text-xs leading-relaxed sm:p-8 sm:text-sm">
              <code>
                <span className="text-muted-foreground/50">{"// lib/auth.ts"}</span>
                {"\n"}
                <span className="text-link">import</span>
                <span className="text-foreground">{" { betterAuth } "}</span>
                <span className="text-link">from</span>
                <span className="text-muted-foreground">
                  {' "better-auth"'}
                </span>
                {"\n"}
                <span className="text-link">import</span>
                <span className="text-foreground">
                  {" { prismaAdapter } "}
                </span>
                <span className="text-link">from</span>
                <span className="text-muted-foreground">
                  {' "better-auth/adapters/prisma"'}
                </span>
                {"\n"}
                <span className="text-link">import</span>
                <span className="text-foreground">
                  {" { twoFactor } "}
                </span>
                <span className="text-link">from</span>
                <span className="text-muted-foreground">
                  {' "better-auth/plugins"'}
                </span>
                {"\n\n"}
                <span className="text-link">export const</span>
                <span className="text-foreground"> auth </span>
                <span className="text-link">=</span>
                <span className="text-foreground"> betterAuth</span>
                <span className="text-muted-foreground">{"({"}</span>
                {"\n"}
                <span className="text-foreground">{"  database: "}</span>
                <span className="text-foreground">{"prismaAdapter(prisma),"}</span>
                {"\n"}
                <span className="text-foreground">
                  {"  plugins: [twoFactor()],"}
                </span>
                {"\n"}
                <span className="text-foreground">
                  {"  emailAndPassword: { enabled: "}
                </span>
                <span className="text-success">true</span>
                <span className="text-foreground">{" },"}</span>
                {"\n"}
                <span className="text-foreground">
                  {"  socialProviders: { google: { ... } },"}
                </span>
                {"\n"}
                <span className="text-muted-foreground">{"})"}</span>
                {"\n\n"}
                <span className="text-muted-foreground/50">
                  {"// That's it. You're done. ✓"}
                </span>
              </code>
            </pre>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          TECH STACK
      ════════════════════════════════════════════ */}
      <section id="stack" className="py-24 sm:py-32">
        <div className="mx-auto max-w-5xl px-6 sm:px-10">
          <div className="fade-in mb-14">
            <p className="text-sm text-muted-foreground">
              Built With
            </p>
            <h2 className="mt-3 font-semibold tracking-tight text-3xl sm:text-5xl text-foreground">
              Modern stack.
              <br />
              <span className="text-muted-foreground/70">Zero compromise.</span>
            </h2>
          </div>

          <div className="tech-grid grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4">
            {TECH.map((name) => (
              <div
                key={name}
                className="tech-item group flex items-center justify-center border border-border bg-background py-5 text-center transition-all duration-500 hover:border-accent hover:bg-card sm:py-7"
                data-hover
              >
                <span className="text-sm tracking-wider text-muted-foreground transition-colors duration-500 group-hover:text-foreground">
                  {name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          CTA
      ════════════════════════════════════════════ */}
      <section className="cta-section relative overflow-hidden py-32 sm:py-44">
        <div className="relative mx-auto max-w-4xl px-6 text-center sm:px-10">
          <h2 className="cta-text font-semibold tracking-tight text-4xl leading-tight sm:text-6xl md:text-7xl lg:text-8xl text-foreground">
            Start building
            <br />
            <span className="italic text-muted-foreground/60">today.</span>
          </h2>
          <div className="mt-10 sm:mt-14">
            <Link
              href="/auth/register"
              className="cta-button group relative inline-flex items-center gap-3 rounded-md bg-foreground px-10 py-4 text-sm font-normal text-background transition-all hover:bg-foreground/90"
              data-hover
            >
              GET STARTED FREE
              <svg
                className="h-4 w-4 transition-transform group-hover:translate-x-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
            </Link>
          </div>
          <p className="mt-6 text-xs tracking-wide text-muted-foreground/50">
            No credit card required. Deploy in under 5 minutes.
          </p>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          FOOTER
      ════════════════════════════════════════════ */}
      <footer className="landing-footer border-t border-border">
        <div className="footer-content mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 py-10 sm:flex-row sm:px-10">
          <div className="flex items-center gap-8">
            <span className="font-normal text-sm text-foreground/60">
              RAPID
            </span>
            <span className="text-xs text-muted-foreground/40">
              &copy; {new Date().getFullYear()}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
            <a
              href="#features"
              className="text-xs tracking-wide text-muted-foreground/50 transition-colors hover:text-foreground/70"
            >
              Features
            </a>
            <a
              href="#stack"
              className="text-xs tracking-wide text-muted-foreground/50 transition-colors hover:text-foreground/70"
            >
              Stack
            </a>
            <Link
              href="/auth/login"
              className="text-xs tracking-wide text-muted-foreground/50 transition-colors hover:text-foreground/70"
            >
              Sign In
            </Link>
            <Link
              href="/dashboard"
              className="text-xs tracking-wide text-muted-foreground/50 transition-colors hover:text-foreground/70"
            >
              Dashboard
            </Link>
            <Link
              href="/terms"
              className="text-xs tracking-wide text-muted-foreground/50 transition-colors hover:text-foreground/70"
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              className="text-xs tracking-wide text-muted-foreground/50 transition-colors hover:text-foreground/70"
            >
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
