import { useInView } from "@/hooks/useInView";
import howItWorksImg from "@/assets/how-it-works.png";

const HowItWorks = () => {
  const { ref, inView } = useInView();

  return (
    <section className="py-10 md:py-12 bg-background">
      <div
        ref={ref}
        className={`container transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}
      >
        <h2 className="text-center text-foreground font-extrabold text-[32px] mb-6">
          Como fazer seu <span className="text-highlight">pedido</span>
        </h2>

        <div className="flex justify-center">
          <img
            src={howItWorksImg}
            alt="Passo a passo para fazer seu pedido de brindes personalizados"
            className="w-full max-w-4xl rounded-2xl"
          />
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
