import type { Metadata } from "next";
import Image from "next/image";
import BusinessDirectory from "@/components/business-directory/BusinessDirectory";
import styles from "./businesses.module.css";
export const metadata: Metadata = {
  title: { absolute: "WDU Business Directory | Swiftdu" },
  alternates: { canonical: "/businesses" },
  description:
    "Discover businesses, services and student entrepreneurs across the Western Delta University community.",
};
export default function BusinessesPage() {
  return (
    <main className="relative isolate min-h-screen overflow-x-clip bg-[#faf9f7] px-4 pb-20 pt-32 text-slate-950 sm:px-8 sm:pt-40 lg:pt-44">
      <div aria-hidden="true" className={styles.artwork}>
        <div className={styles.student}>
          <Image
            src="/businesses/student-cutout.png"
            alt=""
            width={1672}
            height={941}
            sizes="1050px"
            className={styles.studentImage}
          />
        </div>
        <div className={styles.campus}>
          <Image
            src="/businesses/campus-building.png"
            alt=""
            fill
            sizes="(min-width: 1440px) 400px, 30vw"
            className="object-contain object-bottom"
          />
        </div>
        <div className={styles.leftDoodle}>
          <Image
            src="/businesses/business-doodles.png"
            alt=""
            width={1448}
            height={1086}
            sizes="440px"
            className={styles.leftDoodleImage}
          />
        </div>
        <div className={styles.rightDoodle}>
          <Image
            src="/businesses/business-doodles.png"
            alt=""
            width={1448}
            height={1086}
            sizes="440px"
            className={styles.rightDoodleImage}
          />
        </div>
      </div>
      <div className="relative mx-auto max-w-7xl">
        <header className="mx-auto max-w-2xl pb-8 text-center lg:pb-10">
          <p className="mb-5 text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600 sm:text-xs">
            WDU Business Directory
          </p>
          <h1 className="text-[2.5rem] font-extrabold leading-[1.08] tracking-[-0.045em] sm:text-6xl lg:text-[4rem]">
            What do you need
            <span className="hidden sm:inline">
              <br />
            </span>{" "}
            today?
          </h1>
          <p className="mx-auto mt-5 max-w-md text-[15px] leading-7 text-slate-500 sm:text-base">
            Tell us what you&apos;re looking for and we&apos;ll find businesses
            around WDU that can help.
          </p>
        </header>
        <BusinessDirectory />
      </div>
    </main>
  );
}
