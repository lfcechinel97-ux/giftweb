const BannerSeparator = () => {
  return (
    <section className="w-full px-4 md:px-6 py-4">
      <div
        className="w-full max-h-[80px] flex items-center justify-center rounded-2xl py-4 md:py-5 px-6 md:px-10 shadow-lg"
        style={{
          background: "linear-gradient(135deg, #1E4D6B, #163d56)",
        }}
      >
        <p className="text-white text-sm md:text-base lg:text-lg font-light tracking-wide text-center leading-snug">
          Brindes corporativos{" "}
          <span style={{ color: "#A3E635" }} className="font-medium">
            no prazo.
          </span>{" "}
          Sem complicação. Sem dor de cabeça.
        </p>
      </div>
    </section>
  );
};

export default BannerSeparator;
