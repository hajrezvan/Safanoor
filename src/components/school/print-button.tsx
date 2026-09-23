"use client";
export function PrintCertificate() {
  return (
    <button
      className="mt-6 rounded-xl bg-teal-800 px-6 py-3 text-white print:hidden"
      onClick={() => window.print()}
    >
      چاپ / ذخیره PDF
    </button>
  );
}
