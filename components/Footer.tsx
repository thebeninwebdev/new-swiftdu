import Image from "next/image";
import Link from "next/link";

export const Footer = () => {
  return (
    <footer className="bg-gray-900 text-white py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <Link href="/" className="inline-flex items-center">
            <Image
              src="/logo.png"
              alt="Swiftdu"
              width={342}
              height={63}
              className="h-10 w-auto object-contain"
            />
          </Link>
          <p className="text-gray-400 text-sm">
            © 2025 Swiftdu. Built at Western Delta University.
          </p>
          <div className="flex gap-6">
            <Link href="/" className="text-gray-400 hover:text-white transition-colors">Home</Link>
            <Link href="/terms" className="text-gray-400 hover:text-white transition-colors">Terms and Conditions</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
