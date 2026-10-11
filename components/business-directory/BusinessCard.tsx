import Image from "next/image";
import { MapPin, MessageCircle, Phone, Instagram, Mail } from "lucide-react";
import {
  normalizeInstagramHandle,
  normalizePhoneNumber,
  type PublicBusiness,
} from "@/lib/business-directory";
export default function BusinessCard({
  business: b,
}: {
  business: PublicBusiness;
}) {
  const phone = normalizePhoneNumber(b.phone || "");
  const whatsapp = normalizePhoneNumber(b.whatsapp || "");
  const instagram = normalizeInstagramHandle(b.instagram || "");
  const contacts = [
    ...(whatsapp
      ? [
          {
            label: "Chat on WhatsApp",
            href: `https://wa.me/${whatsapp}`,
            icon: MessageCircle,
            external: true,
          },
        ]
      : []),
    ...(phone
      ? [
          {
            label: "Call business",
            href: `tel:+${phone}`,
            icon: Phone,
            external: false,
          },
        ]
      : []),
    ...(instagram
      ? [
          {
            label: "View Instagram",
            href: `https://www.instagram.com/${instagram}/`,
            icon: Instagram,
            external: true,
          },
        ]
      : []),
    ...(b.email
      ? [
          {
            label: "Email business",
            href: `mailto:${b.email}`,
            icon: Mail,
            external: false,
          },
        ]
      : []),
  ];
  const [primary, ...secondary] = contacts;
  return (
    <article
      id={b.slug}
      className="flex min-w-0 scroll-mt-28 flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm"
    >
      <div className="relative aspect-[16/10] bg-indigo-50">
        <Image
          src={b.imageUrl}
          alt={`${b.businessName} business image`}
          fill
          sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 33vw"
          className="object-cover"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col p-5 sm:p-6">
        <p className="w-fit max-w-full break-words rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
          {b.category}
        </p>
        <h3 className="mt-3 break-words text-xl font-bold tracking-tight text-slate-950">
          {b.businessName}
        </h3>
        <p className="mt-2 line-clamp-3 break-words text-sm leading-6 text-slate-600">
          {b.description}
        </p>
        <ul
          aria-label="Products and services"
          className="my-4 flex flex-wrap gap-2"
        >
          {b.productsServices.slice(0, 4).map((item, i) => (
            <li
              key={i}
              className="max-w-full break-words rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs leading-5 text-slate-600"
            >
              {item}
            </li>
          ))}
        </ul>
        {b.location && (
          <p className="mb-5 flex items-start gap-2 text-sm leading-6 text-slate-500">
            <MapPin aria-hidden="true" className="mt-1 size-4 shrink-0" />
            <span className="min-w-0 break-words">{b.location}</span>
          </p>
        )}
        <div className="mt-auto border-t border-slate-100 pt-4">
          {primary ? (
            <>
              <a
                href={primary.href}
                target={primary.external ? "_blank" : undefined}
                rel={primary.external ? "noopener noreferrer" : undefined}
                aria-label={`${primary.label}: ${b.businessName}`}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-3 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                <primary.icon aria-hidden="true" className="size-4 shrink-0" />
                {primary.label}
              </a>
              {secondary.length > 0 && (
                <div className="mt-3 flex gap-2">
                  {secondary.map(({ label, href, icon: Icon, external }) => (
                    <a
                      key={label}
                      href={href}
                      aria-label={`${label}: ${b.businessName}`}
                      title={label}
                      target={external ? "_blank" : undefined}
                      rel={external ? "noopener noreferrer" : undefined}
                      className="inline-flex size-11 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                    >
                      <Icon aria-hidden="true" className="size-4" />
                    </a>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-500">
              Contact details are not available yet.
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
