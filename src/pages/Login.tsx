import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useAuth } from "@/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LoginCover {
  id: string;
  alt: string;
  creditText: string;
  creditUrl: string;
  locationText: string;
}

interface LoginCoverWithSource extends LoginCover {
  src: string;
  isPortrait: boolean;
}

const SLIDE_INTERVAL_MS = 10_000;
const FADE_DURATION_MS = 1_000;

const LOGIN_COVERS: LoginCover[] = [
  {
    id: "7VPFyhB_j8Y",
    alt: "ladder on shelf in library",
    creditText: "Photo by Valdemaras D. on Unsplash",
    creditUrl: "https://unsplash.com/photos/ladder-on-shelf-in-library-7VPFyhB_j8Y",
    locationText: "",
  },
  {
    id: "VAUJNfDjjbg",
    alt: "a large library filled with lots of books",
    creditText: "Photo by John Angel on Unsplash",
    creditUrl: "https://unsplash.com/photos/a-large-library-filled-with-lots-of-books-VAUJNfDjjbg",
    locationText: "",
  },
  {
    id: "MmV5044f6W4",
    alt: "A large room with a painting on the ceiling",
    creditText: "Photo by Michael Huh on Unsplash",
    creditUrl: "https://unsplash.com/photos/a-large-room-with-a-painting-on-the-ceiling-MmV5044f6W4",
    locationText: "New York Public Library - Stephen A. Schwarzman Building, 5th Avenue, New York, NY, USA",
  },
  {
    id: "KNUY8VmtL7A",
    alt: "a building with statues on the roof",
    creditText: "Photo by Diane Picchiottino on Unsplash",
    creditUrl: "https://unsplash.com/photos/a-building-with-statues-on-the-roof-KNUY8VmtL7A",
    locationText: "New York Public Library, East 23rd Street, New York, NY, USA",
  },
  {
    id: "QgR5pKDoCd0",
    alt: "Bibliothek building photo",
    creditText: "Photo by Marcel Strauß on Unsplash",
    creditUrl: "https://unsplash.com/photos/bibliothek-building-photo-QgR5pKDoCd0",
    locationText: "Stadtbibliothek am Mailänder Platz, Stuttgart, Germany",
  },
  {
    id: "dURis8Mg-Ks",
    alt: "books inside building",
    creditText: "Photo by Niklas Ohlrogge (niamoh.de) on Unsplash",
    creditUrl: "https://unsplash.com/photos/books-inside-building-dURis8Mg-Ks",
    locationText: "Stuttgart",
  },
  {
    id: "QdJD6uyt-Ec",
    alt: "A room filled with lots of books under a painted ceiling",
    creditText: "Photo by Abdullah Kamil on Unsplash",
    creditUrl: "https://unsplash.com/photos/a-room-filled-with-lots-of-books-under-a-painted-ceiling-QdJD6uyt-Ec",
    locationText: "",
  },
  {
    id: "eXuwPeiqebA",
    alt: "Ornate library interior with tall bookshelves filled with books.",
    creditText: "Photo by Gustavo Sánchez on Unsplash",
    creditUrl: "https://unsplash.com/photos/ornate-library-interior-with-tall-bookshelves-filled-with-books-eXuwPeiqebA",
    locationText: "Río de Janeiro, Estado de Río de Janeiro, Brasil",
  },
  {
    id: "J1rMidPsFWM",
    alt: "a large library filled with lots of books",
    creditText: "Photo by Phuc-Thanh Mai Vo on Unsplash",
    creditUrl: "https://unsplash.com/photos/a-large-library-filled-with-lots-of-books-J1rMidPsFWM",
    locationText: "",
  },
  {
    id: "He8-FZl-o10",
    alt: "photo of library with religious embossed ceiling",
    creditText: "Photo by Hieu Vu Minh on Unsplash",
    creditUrl: "https://unsplash.com/photos/photo-of-library-with-religious-embossed-ceiling-He8-FZl-o10",
    locationText: "Prague, Czech Republic",
  },
  {
    id: "CJAVJ5SF6gA",
    alt: "white wooden bookcase",
    creditText: "Photo by Valdemaras D. on Unsplash",
    creditUrl: "https://unsplash.com/photos/white-wooden-bookcase-CJAVJ5SF6gA",
    locationText: "",
  },
  {
    id: "674oH-T1wNo",
    alt: "a very large building with a bunch of books on it",
    creditText: "Photo by Rosilaine Alves on Unsplash",
    creditUrl: "https://unsplash.com/photos/a-very-large-building-with-a-bunch-of-books-on-it-674oH-T1wNo",
    locationText: "Rio de Janeiro, RJ, Brasil",
  },
  {
    id: "jnx-hyaSp7w",
    alt: "Grand library interior with tall bookshelves and ornate details.",
    creditText: "Photo by Gustavo Sánchez on Unsplash",
    creditUrl: "https://unsplash.com/photos/grand-library-interior-with-tall-bookshelves-and-ornate-details-jnx-hyaSp7w",
    locationText: "Río de Janeiro, Estado de Río de Janeiro, Brasil",
  },
  {
    id: "kmDWZzDpp3k",
    alt: "brown wooden shelves with books",
    creditText: "Photo by Anna Hunko on Unsplash",
    creditUrl: "https://unsplash.com/photos/brown-wooden-shelves-with-books-kmDWZzDpp3k",
    locationText: "Rijksmuseum, Amsterdam, Нидерланды",
  },
  {
    id: "tSKDUqhx99I",
    alt: "an ornate building with columns and a chandelier",
    creditText: "Photo by Phuc-Thanh Mai Vo on Unsplash",
    creditUrl: "https://unsplash.com/photos/an-ornate-building-with-columns-and-a-chandelier-tSKDUqhx99I",
    locationText: "",
  },
  {
    id: "1UpIokRT7GE",
    alt: "brown building interior",
    creditText: "Photo by Matías Santana on Unsplash",
    creditUrl: "https://unsplash.com/photos/brown-building-interior-1UpIokRT7GE",
    locationText: "Teatro Colón, Buenos Aires, Argentina",
  },
  {
    id: "LbDaf8O4FoQ",
    alt: "a building with many balconies",
    creditText: "Photo by Kévin Gachie on Unsplash",
    creditUrl: "https://unsplash.com/photos/a-building-with-many-balconies-LbDaf8O4FoQ",
    locationText: "",
  },
  {
    id: "B_3gNlkW-W0",
    alt: "books room",
    creditText: "Photo by Daniel Filipe Antunes Santos on Unsplash",
    creditUrl: "https://unsplash.com/photos/books-room-B_3gNlkW-W0",
    locationText: "",
  },
  {
    id: "YvB7U1wtfV4",
    alt: "a long row of bookshelves filled with lots of books",
    creditText: "Photo by Abdallah on Unsplash",
    creditUrl: "https://unsplash.com/photos/a-long-row-of-bookshelves-filled-with-lots-of-books-YvB7U1wtfV4",
    locationText: "",
  },
  {
    id: "BaC7JNcbUsg",
    alt: "a room with a lot of books on the walls",
    creditText: "Photo by Claudio Schwarz on Unsplash",
    creditUrl: "https://unsplash.com/photos/a-room-with-a-lot-of-books-on-the-walls-BaC7JNcbUsg",
    locationText: "Stiftsbibliothek St. Gallen, Klosterhof, St. Gallen, Switzerland",
  },
  {
    id: "6TY_gOVgLTs",
    alt: "a large building with a large glass window",
    creditText: "Photo by Riza Gabriela on Unsplash",
    creditUrl: "https://unsplash.com/photos/a-large-building-with-a-large-glass-window-6TY_gOVgLTs",
    locationText: "COEX, Yeongdong-daero, Gangnam-gu, Seoul, South Korea",
  },
  {
    id: "eZMeRdIsRJw",
    alt: "a very tall building with lots of windows",
    creditText: "Photo by MakoMakt on Unsplash",
    creditUrl: "https://unsplash.com/photos/a-very-tall-building-with-lots-of-windows-eZMeRdIsRJw",
    locationText: "Seoul, South Korea",
  },
  {
    id: "jdskTNKJGd8",
    alt: "people walking inside building during daytime",
    creditText: "Photo by Oksana Z on Unsplash",
    creditUrl: "https://unsplash.com/photos/people-walking-inside-building-during-daytime-jdskTNKJGd8",
    locationText: "Palácio Nacional de Mafra, Mafra, Portugal",
  },
  {
    id: "2sgnnzErJU8",
    alt: "gray glass-framed building",
    creditText: "Photo by Ludovic Charlet on Unsplash",
    creditUrl: "https://unsplash.com/photos/gray-glass-framed-building-2sgnnzErJU8",
    locationText: "Storgata 64, 9008 Tromsø, Norway, Tromsø",
  },
  {
    id: "OekAJm9SxH4",
    alt: "zwei Personen, die vor einem großen Gebäude gehen",
    creditText: "Photo by Takuya Jodai on Unsplash",
    creditUrl: "https://unsplash.com/photos/zwei-personen-die-vor-einem-grossen-gebaude-gehen-OekAJm9SxH4",
    locationText: "Keskustakirjasto Oodi, Helsinki, Finland",
  },
  {
    id: "0esKGGhu9Hg",
    alt: "a staircase in a building",
    creditText: "Photo by Daniel Forsman on Unsplash",
    creditUrl: "https://unsplash.com/photos/a-staircase-in-a-building-0esKGGhu9Hg",
    locationText: "Stockholm, Sweden",
  },
  {
    id: "Td7Mk6jhUHQ",
    alt: "a long library filled with lots of books",
    creditText: "Photo by Bree Anne on Unsplash",
    creditUrl: "https://unsplash.com/photos/a-long-library-filled-with-lots-of-books-Td7Mk6jhUHQ",
    locationText: "Trinity College, College Green, Dublin 2, Ireland",
  },
  {
    id: "JLVBJsiaQE0",
    alt: "book lot",
    creditText: "Photo by Hanna Zhyhar on Unsplash",
    creditUrl: "https://unsplash.com/photos/book-lot-JLVBJsiaQE0",
    locationText: "Stockholm Public Library, Stockholm, Sweden",
  },
  {
    id: "PdDBTrkGYLo",
    alt: "a library filled with lots of books and busturines",
    creditText: "Photo by Alex Block on Unsplash",
    creditUrl: "https://unsplash.com/photos/a-library-filled-with-lots-of-books-and-busturines-PdDBTrkGYLo",
    locationText: "Dublin, Ireland",
  },
  {
    id: "tianjin-binhai-library-ossip",
    alt: "Tianjin Binhai Library interior",
    creditText: "Photo by Ossip",
    creditUrl: "",
    locationText: "Tianjin Binhai Library, Tianjin, China",
  },
];

const coverImageModules = import.meta.glob("../assets/login-covers/*.{webp,jpg,jpeg,png}", {
  eager: true,
  import: "default",
}) as Record<string, string>;

const coverImageExtensions = ["webp", "jpg", "jpeg", "png"];

function findCoverSource(coverId: string): string | null {
  return (
    coverImageExtensions
      .map((extension) => coverImageModules[`../assets/login-covers/${coverId}.${extension}`])
      .find(Boolean) ?? null
  );
}

function isPortraitImage(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image.naturalHeight > image.naturalWidth);
    image.onerror = () => resolve(false);
    image.src = src;
  });
}

function pickNextCoverId(covers: LoginCoverWithSource[], currentCoverId: string): string {
  if (covers.length < 2) return currentCoverId;

  const nextCovers = covers.filter((cover) => cover.id !== currentCoverId);
  const nextIndex = Math.floor(Math.random() * nextCovers.length);
  return nextCovers[nextIndex].id;
}

interface LoginFormValues {
  email: string;
  password: string;
}

export default function Login() {
  const { user, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { register, handleSubmit, formState, setError } = useForm<LoginFormValues>();
  const [isMobile, setIsMobile] = useState(false);
  const [allCovers, setAllCovers] = useState<LoginCoverWithSource[]>([]);
  const [currentCoverId, setCurrentCoverId] = useState<string | null>(null);
  const [previousCoverId, setPreviousCoverId] = useState<string | null>(null);
  const [isCurrentVisible, setIsCurrentVisible] = useState(true);
  const fadeTimeoutRef = useRef<number | null>(null);

  // Already authenticated — redirect away from login
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? "/";
  useEffect(() => {
    if (!loading && user) {
      navigate(from, { replace: true });
    }
  }, [user, loading, navigate, from]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const updateIsMobile = () => setIsMobile(mediaQuery.matches);

    updateIsMobile();
    mediaQuery.addEventListener("change", updateIsMobile);

    return () => {
      mediaQuery.removeEventListener("change", updateIsMobile);
    };
  }, []);

  useEffect(() => {
    let canceled = false;

    const loadCovers = async () => {
      const loadedCovers = await Promise.all(
        LOGIN_COVERS.map(async (cover) => {
          const src = findCoverSource(cover.id);
          if (!src) return null;

          const isPortrait = await isPortraitImage(src);
          return {
            ...cover,
            src,
            isPortrait,
          };
        })
      );

      if (canceled) return;

      setAllCovers(loadedCovers.filter(Boolean) as LoginCoverWithSource[]);
    };

    loadCovers();

    return () => {
      canceled = true;
    };
  }, []);

  const eligibleCovers = useMemo(() => {
    if (allCovers.length === 0) return [];

    const filtered = allCovers.filter((cover) => isMobile || !cover.isPortrait);
    return filtered.length > 0 ? filtered : allCovers;
  }, [allCovers, isMobile]);

  useEffect(() => {
    if (eligibleCovers.length === 0) {
      setCurrentCoverId(null);
      setPreviousCoverId(null);
      return;
    }

    setCurrentCoverId((existingCoverId) => {
      if (existingCoverId && eligibleCovers.some((cover) => cover.id === existingCoverId)) {
        return existingCoverId;
      }

      const randomIndex = Math.floor(Math.random() * eligibleCovers.length);
      return eligibleCovers[randomIndex].id;
    });
  }, [eligibleCovers]);

  useEffect(() => {
    if (!currentCoverId || eligibleCovers.length < 2) return;

    const intervalId = window.setInterval(() => {
      const nextCoverId = pickNextCoverId(eligibleCovers, currentCoverId);
      if (nextCoverId === currentCoverId) return;

      setPreviousCoverId(currentCoverId);
      setCurrentCoverId(nextCoverId);
      setIsCurrentVisible(false);

      requestAnimationFrame(() => {
        setIsCurrentVisible(true);
      });

      if (fadeTimeoutRef.current) {
        window.clearTimeout(fadeTimeoutRef.current);
      }

      fadeTimeoutRef.current = window.setTimeout(() => {
        setPreviousCoverId(null);
      }, FADE_DURATION_MS);
    }, SLIDE_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [currentCoverId, eligibleCovers]);

  useEffect(() => {
    return () => {
      if (fadeTimeoutRef.current) {
        window.clearTimeout(fadeTimeoutRef.current);
      }
    };
  }, []);

  const currentCover =
    eligibleCovers.find((cover) => cover.id === currentCoverId) ?? eligibleCovers[0] ?? null;
  const previousCover = eligibleCovers.find((cover) => cover.id === previousCoverId) ?? null;

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
      </div>
    );
  }

  const onSubmit = async (values: LoginFormValues) => {
    const { error } = await signIn(values.email, values.password);
    if (error) {
      setError("root", { message: error.message });
    }
    // Redirect is handled by the useEffect above when user state updates
  };

  return (
    <main className="relative min-h-svh overflow-hidden bg-zinc-900">
      <div className="absolute inset-0" aria-hidden="true">
        {previousCover && (
          <img
            key={previousCover.id}
            src={previousCover.src}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            loading="eager"
            decoding="async"
          />
        )}

        {currentCover ? (
          <img
            key={currentCover.id}
            src={currentCover.src}
            alt={currentCover.alt}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
              isCurrentVisible ? "opacity-100" : "opacity-0"
            }`}
            loading="eager"
            decoding="async"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-600 via-zinc-700 to-zinc-900" />
        )}

        <div className="absolute inset-0 bg-black/35" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_20%,_rgba(0,0,0,0.55)_100%)]" />
      </div>

      {currentCover?.locationText && (
        <p className="absolute bottom-3 left-3 z-30 max-w-[75%] text-[11px] text-white/80 md:bottom-4 md:left-4">
          {currentCover.locationText}
        </p>
      )}

      {currentCover && (
        <p className="absolute bottom-3 right-3 z-30 max-w-[75%] text-right text-[11px] text-white/80 md:bottom-4 md:right-4">
          {currentCover.creditUrl ? (
            <a
              href={currentCover.creditUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-sm underline decoration-white/40 underline-offset-2 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              {currentCover.creditText}
            </a>
          ) : (
            currentCover.creditText
          )}
        </p>
      )}

      <div className="pointer-events-none relative z-20 flex min-h-svh items-center justify-center px-4 py-8 sm:px-8">
        <div className="pointer-events-auto w-full max-w-sm space-y-6 rounded-xl border border-white/30 bg-background/95 p-6 shadow-xl backdrop-blur-md sm:p-7">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Reading Journal</h1>
            <p className="text-sm text-muted-foreground">Sign in to your account</p>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                {...register("email", { required: "Email is required" })}
              />
              {formState.errors.email && (
                <p className="text-sm text-destructive">{formState.errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register("password", { required: "Password is required" })}
              />
              {formState.errors.password && (
                <p className="text-sm text-destructive">{formState.errors.password.message}</p>
              )}
            </div>
            {formState.errors.root && (
              <p className="text-sm text-destructive">{formState.errors.root.message}</p>
            )}
            <Button type="submit" disabled={formState.isSubmitting} className="w-full">
              {formState.isSubmitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
