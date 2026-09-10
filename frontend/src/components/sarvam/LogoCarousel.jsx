import React from 'react';

const PARTNER_LOGOS = [
  { name: 'Aadhaar', url: 'https://assets.sarvam.ai/tr:dpr-auto/assets/logos/customers/aadhaar.svg', width: 55 },
  { name: 'Axis Bank', url: 'https://assets.sarvam.ai/tr:dpr-auto/assets/logos/customers/axis-bank.svg', width: 120 },
  { name: 'CRED', url: 'https://assets.sarvam.ai/tr:dpr-auto/assets/logos/customers/cred.svg', width: 105 },
  { name: 'CRED Resolve', url: 'https://assets.sarvam.ai/tr:dpr-auto/assets/logos/customers/cred-resolve.svg', width: 140 },
  { name: 'Decentro', url: 'https://assets.sarvam.ai/tr:dpr-auto/assets/logos/customers/decentro.svg', width: 130 },
  { name: 'IDFC', url: 'https://assets.sarvam.ai/tr:dpr-auto/assets/logos/customers/idfc.svg', width: 115 },
  { name: 'IndiaMART', url: 'https://assets.sarvam.ai/tr:dpr-auto/assets/logos/customers/india-mart.svg', width: 38 },
  { name: 'Infosys', url: 'https://assets.sarvam.ai/tr:dpr-auto/assets/logos/customers/infosys.svg', width: 92 },
  { name: 'LIC', url: 'https://assets.sarvam.ai/tr:dpr-auto/assets/logos/customers/lic.svg', width: 70 },
  { name: 'Mahindra Finance', url: 'https://assets.sarvam.ai/tr:dpr-auto/assets/logos/customers/mahindra-finance.svg', width: 110 },
  { name: 'NABARD', url: 'https://assets.sarvam.ai/tr:dpr-auto/assets/logos/customers/nabard.svg', width: 32 },
  { name: 'SBI Life', url: 'https://assets.sarvam.ai/tr:dpr-auto/assets/logos/customers/sbi-life.svg', width: 130 },
  { name: 'Skill India', url: 'https://assets.sarvam.ai/tr:dpr-auto/assets/logos/customers/skill-india.svg', width: 88 },
  { name: 'Tata Capital', url: 'https://assets.sarvam.ai/tr:dpr-auto/assets/logos/customers/tata-capital.svg', width: 62 },
  { name: 'Urban Company', url: 'https://assets.sarvam.ai/tr:dpr-auto/assets/logos/customers/urban-company.svg', width: 115 },
];

export default function LogoCarousel() {
  return (
    <div className="relative w-full overflow-hidden py-4 select-none">
      {/* Left/Right Edge Fades */}
      <div 
        className="pointer-events-none absolute left-0 top-0 bottom-0 z-10 w-24 md:w-40"
        style={{ background: 'linear-gradient(to right, #fafafa 15%, transparent)' }}
      />
      <div 
        className="pointer-events-none absolute right-0 top-0 bottom-0 z-10 w-24 md:w-40"
        style={{ background: 'linear-gradient(to left, #fafafa 15%, transparent)' }}
      />

      <div className="flex w-full overflow-hidden">
        <div className="animate-sarvam-marquee flex items-center gap-12 md:gap-16">
          {/* Repeat twice for continuous infinite marquee */}
          {[...PARTNER_LOGOS, ...PARTNER_LOGOS].map((logo, idx) => (
            <div 
              key={idx} 
              className="flex-shrink-0 flex items-center justify-center opacity-45 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-300 transform hover:scale-105"
              style={{ minWidth: `${logo.width}px` }}
            >
              <img 
                src={logo.url} 
                alt={logo.name} 
                loading="lazy" 
                className="h-8 md:h-9 object-contain pointer-events-none"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
