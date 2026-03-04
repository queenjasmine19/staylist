import { Link } from "wouter";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#F2F0ED] p-4">
      <div className="bg-white p-14 rounded-[32px] border-[0.5px] border-[#D1CDC7] text-center max-w-md w-full">
        <div className="mb-6 flex justify-center">
          <div className="w-16 h-16 rounded-full bg-[#F2F0ED] flex items-center justify-center text-[#78726B]">
            <AlertCircle className="w-8 h-8 stroke-1" />
          </div>
        </div>

        <h1 className="font-serif text-4xl mb-4 text-[#2C2926]">Page Not Found</h1>
        <p className="text-[#78726B] mb-8 font-sans text-base">
          This page doesn't exist in our collection.
        </p>

        <Link href="/" className="inline-flex items-center justify-center px-8 py-3 rounded-full border border-[#2C2926] text-[#2C2926] font-serif text-sm tracking-wide transition-all duration-300 hover:bg-[#2C2926] hover:text-white">
          Return Home
        </Link>
      </div>
    </div>
  );
}
