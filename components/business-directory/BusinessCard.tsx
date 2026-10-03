import Image from "next/image";
import { MapPin, MessageCircle, Phone, Instagram } from "lucide-react";
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
  const phone = normalizePhoneNumber(b.phone),
    whatsapp = normalizePhoneNumber(b.whatsapp),
    instagram = normalizeInstagramHandle(b.instagram || "");
  return (
    <article
      id={b.slug}
      className="flex scroll-mt-28 flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm"
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
      <div className="flex flex-1 flex-col p-6">
        <p className="text-xs font-bold uppercase tracking-wide text-indigo-600">
          {b.category}
        </p>
        <h2 className="mt-2 break-words text-2xl font-bold">
          {b.businessName}
        </h2>
        <p className="mt-3 break-words text-sm leading-6 text-slate-600">
          {b.description}
        </p>
        <ul className="my-4 flex flex-wrap gap-2">
          {b.productsServices.slice(0, 4).map((item, i) => (
            <li
              key={i}
              className="rounded-full bg-slate-50 px-3 py-1 text-xs text-slate-600"
            >
              {item}
            </li>
          ))}
        </ul>
        {b.location && (
          <p className="mb-4 flex items-center gap-2 text-sm text-slate-500">
            <MapPin size={16} />
            {b.location}
          </p>
        )}
        <p className="mb-4 text-xs text-slate-500">
          Contact: {b.ownerName} · Listed{" "}
          {new Date(b.createdAt).toLocaleDateString("en-GB", {
            timeZone: "UTC",
          })}
        </p>
        <div className="mt-auto flex flex-wrap gap-2">
          {whatsapp && (
            <a
              className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
              href={`https://wa.me/${whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle size={16} />
              WhatsApp
            </a>
          )}
          {phone && (
            <a
              className="inline-flex items-center gap-2 rounded-full border px-4 py-3 text-sm"
              href={`tel:+${phone}`}
            >
              <Phone size={16} />
              Call
            </a>
          )}
          {instagram && (
            <a
              aria-label={`${b.businessName} on Instagram`}
              className="rounded-full border p-3"
              href={`https://www.instagram.com/${instagram}/`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Instagram size={18} />
            </a>
          )}
        </div>
        <p className="mt-4 text-xs text-slate-400">Listed on SwiftDU</p>
      </div>
    </article>
  );
}
