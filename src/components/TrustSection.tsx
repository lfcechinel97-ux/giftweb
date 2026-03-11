import instaPost1 from "@/assets/insta-post-1.jpg";
import instaPost2 from "@/assets/insta-post-2.jpg";
import instaPost3 from "@/assets/insta-post-3.jpg";
import instaPost4 from "@/assets/insta-post-4.jpg";
import { Instagram, Play, ExternalLink, Users } from "lucide-react";

const posts = [
  { img: instaPost1, caption: "Kit corporativo completo com garrafas e cadernos personalizados 💼✨ #brindes #corporativo", isVideo: false },
  { img: instaPost2, caption: "Ecobags personalizadas para eventos sustentáveis 🌿 #ecobag #sustentabilidade", isVideo: false },
  { img: instaPost3, caption: "Kits executivos com canetas, canecas e acessórios premium 🎁 #brindescorporativos", isVideo: false },
  { img: instaPost4, caption: "Nos bastidores da produção: personalização a laser dos seus brindes 🔥", isVideo: true },
];

const followerAvatars = [
  "https://i.pravatar.cc/40?img=1",
  "https://i.pravatar.cc/40?img=2",
  "https://i.pravatar.cc/40?img=3",
  "https://i.pravatar.cc/40?img=4",
  "https://i.pravatar.cc/40?img=5",
];

const TrustSection = () => (
  <section className="py-14 bg-surface-alt border-t border-border">
    <div className="container">
      {/* Creative title */}
      <div className="text-center mb-10">
        <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
          <span className="text-muted-foreground font-light uppercase tracking-[0.2em] text-lg md:text-xl block mb-1">
            Acompanhe a
          </span>
          <span className="text-foreground">GIFT </span>
          <span className="text-highlight">WEB</span>
          <span className="text-foreground"> no </span>
          <span className="bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#F77737] bg-clip-text text-transparent font-black">
            Instagram
          </span>
        </h2>
        <a
          href="https://instagram.com/giftweboficial"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 mt-2 text-primary font-semibold text-sm hover:underline"
        >
          <Instagram size={16} />
          @giftweboficial
        </a>
      </div>

      {/* Posts Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {posts.map((post, i) => (
          <div key={i} className="rounded-xl overflow-hidden bg-card border border-border group">
            <div className="aspect-square relative overflow-hidden">
              <img src={post.img} alt={post.caption} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
              {post.isVideo && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-background/70 backdrop-blur-sm flex items-center justify-center">
                    <Play size={20} className="text-foreground ml-0.5" fill="currentColor" />
                  </div>
                </div>
              )}
            </div>
            <div className="p-3">
              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-3">{post.caption}</p>
              <a href="https://instagram.com/giftweboficial" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary hover:underline">
                <ExternalLink size={12} />
                Ver no Instagram
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Followers + CTA */}
      <div className="flex flex-col items-center mt-10 gap-4">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {followerAvatars.map((src, i) => (
              <img key={i} src={src} alt="" className="w-8 h-8 rounded-full border-2 border-card object-cover" />
            ))}
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Users size={14} className="text-primary" />
            <span className="font-bold text-foreground">+5k</span> seguidores
          </div>
        </div>
        <a
          href="https://instagram.com/giftweboficial"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#F77737] text-white font-bold text-sm hover:opacity-90 transition-opacity"
        >
          <Instagram size={18} />
          Siga nosso Instagram
        </a>
      </div>
    </div>
  </section>
);

export default TrustSection;
