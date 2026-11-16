declare module "arabic-persian-reshaper" {
  const ArabicReshaper: {
    ArabicShaper: {
      convertArabic(text: string): string;
      convertArabicBack(text: string): string;
    };
    PersianShaper: {
      convertArabic(text: string): string;
      convertArabicBack(text: string): string;
    };
  };
  export default ArabicReshaper;
}
