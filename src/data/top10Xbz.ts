// Gerado a partir de TOP10_XBZ_por_Categoria.xlsx — ranking de vendas XBZ.
// Não editar à mão: use /admin/top10produtos para ativar/desativar itens.

export interface Top10Item {
  posicao: number;
  codigoPai: string;
  codigoPrefixo: string;
  nomePlanilha: string;
  unidVend: number;
}

export interface Top10Categoria {
  slug: string;
  label: string;
  itens: Top10Item[];
}

export interface Top10Secao {
  slug: string;
  label: string;
  categorias: Top10Categoria[];
}

export const TOP10_SECOES: Top10Secao[] = [
  {
    slug: "copos-garrafas-e-canecas",
    label: "Copos, Garrafas e Canecas",
    categorias: [
      {
        slug: "copos",
        label: "Copos",
        itens: [
          { posicao: 1, codigoPai: "18645L", codigoPrefixo: "18645L", nomePlanilha: "COPO TÉRMICO 500ML *LISO C/ ABRIDOR", unidVend: 262157 },
          { posicao: 2, codigoPai: "3006", codigoPrefixo: "03006", nomePlanilha: "COPO FIBRA DE BAMBU 350ML", unidVend: 226752 },
          { posicao: 3, codigoPai: "14874", codigoPrefixo: "14874", nomePlanilha: "COPO FIBRA DE ARROZ 550ML", unidVend: 144977 },
          { posicao: 4, codigoPai: "03006A", codigoPrefixo: "03006A", nomePlanilha: "COPO FIBRA DE BAMBU 350ML", unidVend: 144102 },
          { posicao: 5, codigoPai: "6094", codigoPrefixo: "06094", nomePlanilha: "COPO VIDRO PAREDE DUPLA 80ML", unidVend: 144094 },
          { posicao: 6, codigoPai: "14726L", codigoPrefixo: "14726L", nomePlanilha: "COPO TÉRMICO INOX 320ML", unidVend: 124830 },
          { posicao: 7, codigoPai: "14498", codigoPrefixo: "14498", nomePlanilha: "COPO FIBRA DE ARROZ 350ML", unidVend: 121741 },
          { posicao: 8, codigoPai: "8245", codigoPrefixo: "08245", nomePlanilha: "COPO INOX PAREDE DUPLA 150ML", unidVend: 105687 },
          { posicao: 9, codigoPai: "18636", codigoPrefixo: "18636", nomePlanilha: "COPO RETRÁTIL DE SILICONE 150ML", unidVend: 86527 },
          { posicao: 10, codigoPai: "6096", codigoPrefixo: "06096", nomePlanilha: "COPO VIDRO PAREDE DUPLA 160ML", unidVend: 79291 },
        ],
      },
      {
        slug: "garrafas-termicas-squeezes",
        label: "Garrafas Térmicas / Squeezes",
        itens: [
          { posicao: 1, codigoPai: "12487F", codigoPrefixo: "12487F", nomePlanilha: "SQUEEZE ALUMINIO FOSCO 650ML", unidVend: 450497 },
          { posicao: 2, codigoPai: "12459", codigoPrefixo: "12459", nomePlanilha: "SQUEEZE DOBRAVEL 450ML MOSQUETAO", unidVend: 159263 },
          { posicao: 3, codigoPai: "9139A", codigoPrefixo: "9139A", nomePlanilha: "SQUEEZE ALUMINIO 500ML C/ BICO E MOSQUETÃO -PRE", unidVend: 111207 },
          { posicao: 4, codigoPai: "9139AS", codigoPrefixo: "9139AS", nomePlanilha: "SQUEEZE ALUMINIO 500ML C/ BICO E MOSQUETÃO", unidVend: 105398 },
          { posicao: 5, codigoPai: "17012", codigoPrefixo: "17012", nomePlanilha: "GARRAFA PLÁSTICA 700ML", unidVend: 87602 },
          { posicao: 6, codigoPai: "9072", codigoPrefixo: "09072", nomePlanilha: "SQUEEZE PLASTICO 500ML BIC PLASTIC", unidVend: 86600 },
          { posicao: 7, codigoPai: "12487B", codigoPrefixo: "12487B", nomePlanilha: "SQUEEZE ALUMINIO BRILHANTE 650ML", unidVend: 85867 },
          { posicao: 8, codigoPai: "2112", codigoPrefixo: "02112", nomePlanilha: "GARRAFA TÉRMICA 400ML", unidVend: 85422 },
          { posicao: 9, codigoPai: "18695", codigoPrefixo: "18695", nomePlanilha: "GARRAFA PLÁSTICA 600ML -TRA", unidVend: 78874 },
          { posicao: 10, codigoPai: "9138", codigoPrefixo: "09138", nomePlanilha: "SQUEEZE ALUMÍNIO 420ML C/ MOSQUETÃO -BCO", unidVend: 76583 },
        ],
      },
      {
        slug: "garrafas-de-inox-aluminio",
        label: "Garrafas de Inox / Alumínio",
        itens: [
          { posicao: 1, codigoPai: "18552", codigoPrefixo: "18552", nomePlanilha: "GARRAFA INOX 750ML -PRE", unidVend: 88198 },
          { posicao: 2, codigoPai: "17010B", codigoPrefixo: "17010B", nomePlanilha: "GARRAFA 750ML INOX", unidVend: 85995 },
          { posicao: 3, codigoPai: "17011F", codigoPrefixo: "17011F", nomePlanilha: "GARRAFA 750ML INOX TAMPA PRATA", unidVend: 82849 },
          { posicao: 4, codigoPai: "7047", codigoPrefixo: "07047", nomePlanilha: "GARRAFA ALUMÍNIO 630ML", unidVend: 58814 },
          { posicao: 5, codigoPai: "18855", codigoPrefixo: "18855", nomePlanilha: "GARRAFA TÉRMICA INOX 850ML", unidVend: 42154 },
          { posicao: 6, codigoPai: "18726I", codigoPrefixo: "18726I", nomePlanilha: "GARRAFA INOX 800ML", unidVend: 34779 },
          { posicao: 7, codigoPai: "6012", codigoPrefixo: "06012", nomePlanilha: "GARRAFA INOX PAREDE DUPLA 250ML", unidVend: 33952 },
          { posicao: 8, codigoPai: "18781", codigoPrefixo: "18781", nomePlanilha: "GARRAFA DE ALUMÍNIO 600ML", unidVend: 25829 },
          { posicao: 9, codigoPai: "18725", codigoPrefixo: "18725", nomePlanilha: "GARRAFA INOX 800ML", unidVend: 25312 },
          { posicao: 10, codigoPai: "8195", codigoPrefixo: "08195", nomePlanilha: "GARRAFA TÉRMICA INOX 550ML", unidVend: 22220 },
        ],
      },
      {
        slug: "canecas",
        label: "Canecas",
        itens: [
          { posicao: 1, codigoPai: "7392", codigoPrefixo: "07392", nomePlanilha: "CANECA INOX 180ML C/ TAMPA", unidVend: 1069669 },
          { posicao: 2, codigoPai: "3889", codigoPrefixo: "03889", nomePlanilha: "CANECA 400ML C/ TAMPA", unidVend: 138310 },
          { posicao: 3, codigoPai: "14508", codigoPrefixo: "14508", nomePlanilha: "CANECA FIBRA DE ARROZ", unidVend: 130961 },
          { posicao: 4, codigoPai: "13282", codigoPrefixo: "13282", nomePlanilha: "CANECA DE CERÂMICA 330ML", unidVend: 77613 },
          { posicao: 5, codigoPai: "4070", codigoPrefixo: "04070", nomePlanilha: "CANECA TÉRMICA 700ML", unidVend: 51249 },
          { posicao: 6, codigoPai: "6033", codigoPrefixo: "06033", nomePlanilha: "CANECA TÉRMICA 1,2L  -PRE", unidVend: 36668 },
          { posicao: 7, codigoPai: "5828", codigoPrefixo: "05828", nomePlanilha: "CANECA 450ML INOX C/ TAMPA", unidVend: 35267 },
          { posicao: 8, codigoPai: "3590", codigoPrefixo: "03590", nomePlanilha: "CANECA INOX 370ML", unidVend: 33934 },
          { posicao: 9, codigoPai: "18623", codigoPrefixo: "18623", nomePlanilha: "CANECA INOX ISOTÉRMICO 250ML", unidVend: 33702 },
          { posicao: 10, codigoPai: "18912", codigoPrefixo: "18912", nomePlanilha: "CANECA TÉRMICA INOX 300ML", unidVend: 30096 },
        ],
      },
    ],
  },
  {
    slug: "mochilas-bolsas-termicas-e-malas",
    label: "Mochilas, Bolsas Térmicas e Malas",
    categorias: [
      {
        slug: "mochilas-e-sacochilas",
        label: "Mochilas e Sacochilas",
        itens: [
          { posicao: 1, codigoPai: "2079", codigoPrefixo: "02079", nomePlanilha: "SACOCHILA EM POLIÉSTER", unidVend: 1046381 },
          { posicao: 2, codigoPai: "1320", codigoPrefixo: "01320", nomePlanilha: "MOCHILA -PRE", unidVend: 218497 },
          { posicao: 3, codigoPai: "18539", codigoPrefixo: "18539", nomePlanilha: "MOCHILA DE NYLON DOBRÁVEL 21L", unidVend: 180378 },
          { posicao: 4, codigoPai: "2105", codigoPrefixo: "02105", nomePlanilha: "MOCHILA NYLON 17L", unidVend: 69344 },
          { posicao: 5, codigoPai: "2066", codigoPrefixo: "02066", nomePlanilha: "MOCHILA NYLON POLIESTER", unidVend: 60046 },
          { posicao: 6, codigoPai: "18601", codigoPrefixo: "18601", nomePlanilha: "SACOCHILA POLIÉSTER", unidVend: 54997 },
          { posicao: 7, codigoPai: "3034", codigoPrefixo: "03034", nomePlanilha: "MOCHILA DE NYLON USB 21L", unidVend: 54603 },
          { posicao: 8, codigoPai: "1326", codigoPrefixo: "01326", nomePlanilha: "MOCHILA DE NYLON USB 21L", unidVend: 46266 },
          { posicao: 9, codigoPai: "14805", codigoPrefixo: "14805", nomePlanilha: "SACOCHILA TNT", unidVend: 43170 },
          { posicao: 10, codigoPai: "3029", codigoPrefixo: "03029", nomePlanilha: "MOCHILA POLIÉSTER 27L", unidVend: 42713 },
        ],
      },
      {
        slug: "bolsas-termicas",
        label: "Bolsas Térmicas",
        itens: [
          { posicao: 1, codigoPai: "18503", codigoPrefixo: "18503", nomePlanilha: "BOLSA TÉRMICA 6L", unidVend: 118482 },
          { posicao: 2, codigoPai: "6047", codigoPrefixo: "06047", nomePlanilha: "BOLSA TÉRMICA 4 LITROS", unidVend: 95334 },
          { posicao: 3, codigoPai: "6024", codigoPrefixo: "06024", nomePlanilha: "BOLSA TÉRMICA 6L", unidVend: 87033 },
          { posicao: 4, codigoPai: "4357", codigoPrefixo: "04357", nomePlanilha: "BOLSA TÉRMICA 10L", unidVend: 64163 },
          { posicao: 5, codigoPai: "2596", codigoPrefixo: "02596", nomePlanilha: "BOLSA TÉRMICA 15L", unidVend: 47052 },
          { posicao: 6, codigoPai: "2399", codigoPrefixo: "02399", nomePlanilha: "BOLSA TÉRMICA 6 LITROS", unidVend: 46820 },
          { posicao: 7, codigoPai: "2099", codigoPrefixo: "02099", nomePlanilha: "BOLSA TÉRMICA 7L", unidVend: 42141 },
          { posicao: 8, codigoPai: "2697", codigoPrefixo: "02697", nomePlanilha: "BOLSA TÉRMICA 17L", unidVend: 35139 },
          { posicao: 9, codigoPai: "18523", codigoPrefixo: "18523", nomePlanilha: "BOLSA TÉRMICA 13L", unidVend: 34394 },
          { posicao: 10, codigoPai: "4385", codigoPrefixo: "04385", nomePlanilha: "BOLSA TÉRMICA 9 LITROS -PRE", unidVend: 29985 },
        ],
      },
      {
        slug: "malas-de-viagem",
        label: "Malas de Viagem",
        itens: [
          { posicao: 1, codigoPai: "6067", codigoPrefixo: "06067", nomePlanilha: "MALA DE BORDO 45L", unidVend: 2878 },
          { posicao: 2, codigoPai: "06070P", codigoPrefixo: "06070P", nomePlanilha: "MALA DE BORDO 30 LITROS", unidVend: 2095 },
          { posicao: 3, codigoPai: "06070M", codigoPrefixo: "06070M", nomePlanilha: "MALA DE BORDO 47 LITROS", unidVend: 1744 },
          { posicao: 4, codigoPai: "8215", codigoPrefixo: "08215", nomePlanilha: "MALA 51 LITROS", unidVend: 1370 },
          { posicao: 5, codigoPai: "15436", codigoPrefixo: "15436", nomePlanilha: "BALANÇA DIGITAL PARA MALA", unidVend: 1109 },
          { posicao: 6, codigoPai: "8242", codigoPrefixo: "08242", nomePlanilha: "MALA DE VIAGEM 37L", unidVend: 1043 },
          { posicao: 7, codigoPai: "8243", codigoPrefixo: "08243", nomePlanilha: "MALA DE VIAGEM 68L", unidVend: 861 },
          { posicao: 8, codigoPai: "8171", codigoPrefixo: "08171", nomePlanilha: "MALA DE VIAGEM 37L", unidVend: 716 },
          { posicao: 9, codigoPai: "08216P", codigoPrefixo: "08216P", nomePlanilha: "MALA DE BORDO ABS 32 LITROS", unidVend: 683 },
          { posicao: 10, codigoPai: "6068", codigoPrefixo: "06068", nomePlanilha: "MALA DE VIAGEM 66L", unidVend: 602 },
        ],
      },
    ],
  },
  {
    slug: "necessaires-porta-joias-e-kit-manicure",
    label: "Necessaires, Porta Joias e Kit Manicure",
    categorias: [
      {
        slug: "necessaires",
        label: "Necessaires",
        itens: [
          { posicao: 1, codigoPai: "18516", codigoPrefixo: "18516", nomePlanilha: "NECESSAIRE EM POLIESTER IMPERMEÁVEL", unidVend: 378240 },
          { posicao: 2, codigoPai: "2092", codigoPrefixo: "02092", nomePlanilha: "NECESSAIRE PLÁSTICA", unidVend: 94539 },
          { posicao: 3, codigoPai: "18501", codigoPrefixo: "18501", nomePlanilha: "NÉCESSAIRE DE NYLON", unidVend: 92050 },
          { posicao: 4, codigoPai: "18738", codigoPrefixo: "18738", nomePlanilha: "NÉCESSAIRE POLIÉSTER", unidVend: 80817 },
          { posicao: 5, codigoPai: "18534", codigoPrefixo: "18534", nomePlanilha: "NECESSAIRE PVC IMPERMEÁVEL", unidVend: 52484 },
          { posicao: 6, codigoPai: "01228P", codigoPrefixo: "01228P", nomePlanilha: "NECESSAIRE PVC IMPERMEÁVEL C/ PLAQUINHA", unidVend: 38819 },
          { posicao: 7, codigoPai: "18507", codigoPrefixo: "18507", nomePlanilha: "NECESSAIRE ORGANIZADORA", unidVend: 37177 },
          { posicao: 8, codigoPai: "18753", codigoPrefixo: "18753", nomePlanilha: "NÉCESSAIRE DE POLIÉSTER", unidVend: 35080 },
          { posicao: 9, codigoPai: "18808", codigoPrefixo: "18808", nomePlanilha: "NÉCESSAIRE PVC IMPERMEÁVEL -BCO", unidVend: 30287 },
          { posicao: 10, codigoPai: "14612", codigoPrefixo: "14612", nomePlanilha: "NECESSAIRE EM NYLON", unidVend: 24531 },
        ],
      },
      {
        slug: "porta-joias",
        label: "Porta Joias",
        itens: [
          { posicao: 1, codigoPai: "01622B", codigoPrefixo: "01622B", nomePlanilha: "PORTA JOIAS", unidVend: 36994 },
          { posicao: 2, codigoPai: "1618", codigoPrefixo: "01618", nomePlanilha: "PORTA-JOIAS", unidVend: 15383 },
          { posicao: 3, codigoPai: "18911", codigoPrefixo: "18911", nomePlanilha: "PORTA-JOIAS COM ESPELHO", unidVend: 5209 },
          { posicao: 4, codigoPai: "O@08141", codigoPrefixo: "O@08141", nomePlanilha: "PORTA-JOIAS COM ESPELHO", unidVend: 4996 },
          { posicao: 5, codigoPai: "8142", codigoPrefixo: "08142", nomePlanilha: "PORTA-JOIAS COM ESPELHO", unidVend: 4903 },
          { posicao: 6, codigoPai: "O@08142", codigoPrefixo: "O@08142", nomePlanilha: "PORTA-JOIAS COM ESPELHO", unidVend: 4219 },
          { posicao: 7, codigoPai: "1622", codigoPrefixo: "01622", nomePlanilha: "PORTA-JOIAS", unidVend: 3310 },
          { posicao: 8, codigoPai: "6017", codigoPrefixo: "06017", nomePlanilha: "PORTA JOIAS", unidVend: 2144 },
          { posicao: 9, codigoPai: "8073", codigoPrefixo: "08073", nomePlanilha: "PORTA JÓIAS COM ESPELHO", unidVend: 1648 },
          { posicao: 10, codigoPai: "18717", codigoPrefixo: "18717", nomePlanilha: "PORTA JOIAS", unidVend: 1592 },
        ],
      },
      {
        slug: "kit-manicure",
        label: "Kit Manicure",
        itens: [
          { posicao: 1, codigoPai: "01361B", codigoPrefixo: "01361B", nomePlanilha: "KIT MANICURE 7 PEÇAS", unidVend: 36229 },
          { posicao: 2, codigoPai: "06040B", codigoPrefixo: "06040B", nomePlanilha: "KIT MANICURE 7 PEÇAS", unidVend: 30146 },
          { posicao: 3, codigoPai: "18733", codigoPrefixo: "18733", nomePlanilha: "CHAVEIRO KIT MANICURE 4 PÇS", unidVend: 6967 },
          { posicao: 4, codigoPai: "18724", codigoPrefixo: "18724", nomePlanilha: "KIT MANICURE 16 PEÇAS -PRE", unidVend: 6780 },
          { posicao: 5, codigoPai: "18724B", codigoPrefixo: "18724B", nomePlanilha: "KIT MANICURE 16 PEÇAS -MAR", unidVend: 5944 },
          { posicao: 6, codigoPai: "18900", codigoPrefixo: "18900", nomePlanilha: "KIT MANICURE 10 PEÇAS -PRE", unidVend: 5654 },
          { posicao: 7, codigoPai: "6040", codigoPrefixo: "06040", nomePlanilha: "KIT MANICURE 7 PEÇAS", unidVend: 3858 },
          { posicao: 8, codigoPai: "10127", codigoPrefixo: "10127", nomePlanilha: "KIT MANICURE 15 PEÇAS C/ ESTOJO", unidVend: 3131 },
          { posicao: 9, codigoPai: "14975", codigoPrefixo: "14975", nomePlanilha: "KIT MANICURE 5 PEÇAS", unidVend: 718 },
          { posicao: 10, codigoPai: "1361", codigoPrefixo: "01361", nomePlanilha: "KIT MANICURE 6 PEÇAS", unidVend: 6 },
        ],
      },
    ],
  },
  {
    slug: "cadernetas-agendas-blocos-e-canetas",
    label: "Cadernetas, Agendas, Blocos e Canetas",
    categorias: [
      {
        slug: "cadernetas",
        label: "Cadernetas",
        itens: [
          { posicao: 1, codigoPai: "3009", codigoPrefixo: "03009", nomePlanilha: "CADERNETA EMBORRACHADA", unidVend: 397230 },
          { posicao: 2, codigoPai: "5067", codigoPrefixo: "05067", nomePlanilha: "CADERNETA EMBORRACHADA", unidVend: 268259 },
          { posicao: 3, codigoPai: "3005", codigoPrefixo: "03005", nomePlanilha: "CADERNETA DE COURO SINTÉTICO", unidVend: 171122 },
          { posicao: 4, codigoPai: "3013", codigoPrefixo: "03013", nomePlanilha: "CADERNETA EM KRAFT", unidVend: 147513 },
          { posicao: 5, codigoPai: "11193", codigoPrefixo: "11193", nomePlanilha: "CADERNETA PLÁSTICA C/ CANETA", unidVend: 147126 },
          { posicao: 6, codigoPai: "14092N", codigoPrefixo: "14092N", nomePlanilha: "CADERNETA EMBORRACHADA COM PORTA CANETA", unidVend: 135649 },
          { posicao: 7, codigoPai: "12514", codigoPrefixo: "12514", nomePlanilha: "CADERNETA EMBORRACHADA", unidVend: 121555 },
          { posicao: 8, codigoPai: "18515", codigoPrefixo: "18515", nomePlanilha: "CADERNETA ECOLÓGICA COM AUTOADESIVOS", unidVend: 115335 },
          { posicao: 9, codigoPai: "03009S", codigoPrefixo: "03009S", nomePlanilha: "CADERNETA EMBORRACHADA S/ PAUTA", unidVend: 79973 },
          { posicao: 10, codigoPai: "5071", codigoPrefixo: "05071", nomePlanilha: "CADERNO A5 PLÁSTICO -PRE", unidVend: 69263 },
        ],
      },
      {
        slug: "agendas",
        label: "Agendas",
        itens: [
          { posicao: 1, codigoPai: "2469", codigoPrefixo: "02469", nomePlanilha: "AGENDA DIÁRIA 2026", unidVend: 30031 },
          { posicao: 2, codigoPai: "6028", codigoPrefixo: "06028", nomePlanilha: "AGENDA COURO SINTÉTICO 2026", unidVend: 10778 },
          { posicao: 3, codigoPai: "9060", codigoPrefixo: "09060", nomePlanilha: "AGENDA DIÁRIA 2026 LINHO", unidVend: 10204 },
          { posicao: 4, codigoPai: "06107A", codigoPrefixo: "06107A", nomePlanilha: "AGENDA SEMANAL 2026", unidVend: 9815 },
          { posicao: 5, codigoPai: "06099A", codigoPrefixo: "06099A", nomePlanilha: "AGENDA DIÁRIA 2026 LINHO", unidVend: 8099 },
          { posicao: 6, codigoPai: "7645", codigoPrefixo: "07645", nomePlanilha: "AGENDA DIÁRIA 2026", unidVend: 5152 },
          { posicao: 7, codigoPai: "14927", codigoPrefixo: "14927", nomePlanilha: "AGENDA 2026 EMBORRACHADA", unidVend: 3803 },
          { posicao: 8, codigoPai: "15139", codigoPrefixo: "15139", nomePlanilha: "AGENDA DIÁRIA 2026", unidVend: 1966 },
          { posicao: 9, codigoPai: "14930", codigoPrefixo: "14930", nomePlanilha: "AGENDA 2026 CROMATO", unidVend: 1531 },
          { posicao: 10, codigoPai: "14926", codigoPrefixo: "14926", nomePlanilha: "AGENDA 2026 CROMATO", unidVend: 1102 },
        ],
      },
      {
        slug: "blocos-de-anotacoes",
        label: "Blocos de Anotações",
        itens: [
          { posicao: 1, codigoPai: "11911S", codigoPrefixo: "11911S", nomePlanilha: "BLOCO DE ANOTAÇÕES C/ AUTO-ADESIVO", unidVend: 419306 },
          { posicao: 2, codigoPai: "12244B", codigoPrefixo: "12244B", nomePlanilha: "BLOCO DE ANOT. C/ AUTOADESIVO", unidVend: 403896 },
          { posicao: 3, codigoPai: "12398", codigoPrefixo: "12398", nomePlanilha: "MINI BLOCO DE ANOT. C/ AUTOADESIVO", unidVend: 271160 },
          { posicao: 4, codigoPai: "5065", codigoPrefixo: "05065", nomePlanilha: "BLOCO DE ANOTAÇÕES C/ AUTO ADESIVOS", unidVend: 192869 },
          { posicao: 5, codigoPai: "11911SB", codigoPrefixo: "11911SB", nomePlanilha: "BLOCO DE ANOTAÇÕES C/ AUTO-ADESIVO", unidVend: 148556 },
          { posicao: 6, codigoPai: "6098", codigoPrefixo: "06098", nomePlanilha: "BLOCO DE ANOTAÇÕES COM CANETA", unidVend: 138108 },
          { posicao: 7, codigoPai: "5064", codigoPrefixo: "05064", nomePlanilha: "BLOCO DE ANOTAÇÕES ECOLÓGICO COM CANETA", unidVend: 130995 },
          { posicao: 8, codigoPai: "12000", codigoPrefixo: "12000", nomePlanilha: "BLOCO DE ANOTAÇÃO", unidVend: 120911 },
          { posicao: 9, codigoPai: "18557", codigoPrefixo: "18557", nomePlanilha: "BLOCO DE ANOTAÇÃO C/ AUTO-ADESIVO", unidVend: 98337 },
          { posicao: 10, codigoPai: "5049", codigoPrefixo: "05049", nomePlanilha: "BLOCO DE ANOTAÇÕES COM AUTOADESIVOS E CANETA", unidVend: 73202 },
        ],
      },
      {
        slug: "canetas",
        label: "Canetas",
        itens: [
          { posicao: 1, codigoPai: "12638", codigoPrefixo: "12638", nomePlanilha: "CANETA PLÁSTICA TOUCH", unidVend: 2491455 },
          { posicao: 2, codigoPai: "708", codigoPrefixo: "00708", nomePlanilha: "CANETA BASE CELULAR LIMP. TELA E PONTA TOUCH", unidVend: 1592351 },
          { posicao: 3, codigoPai: "ER143B", codigoPrefixo: "ER143B", nomePlanilha: "CANETA METAL", unidVend: 1573687 },
          { posicao: 4, codigoPai: "2", codigoPrefixo: "00002", nomePlanilha: "CANETA ECOLÓGICA C/ CLIP PLÁSTICO", unidVend: 1440802 },
          { posicao: 5, codigoPai: "5091", codigoPrefixo: "05091", nomePlanilha: "CANETA PLÁSTICA COM TOUCH", unidVend: 1215951 },
          { posicao: 6, codigoPai: "13546B", codigoPrefixo: "13546B", nomePlanilha: "CANETA C/ 1 ANEL E PONTA TOUCH", unidVend: 732563 },
          { posicao: 7, codigoPai: "01099B", codigoPrefixo: "01099B", nomePlanilha: "CANETA PLASTICA", unidVend: 673840 },
          { posicao: 8, codigoPai: "14949", codigoPrefixo: "14949", nomePlanilha: "CANETA METAL TOUCH", unidVend: 570796 },
          { posicao: 9, codigoPai: "13499B", codigoPrefixo: "13499B", nomePlanilha: "CANETA PLASTICA C/ SUPORTE E TOUCH", unidVend: 565611 },
          { posicao: 10, codigoPai: "05015B", codigoPrefixo: "05015B", nomePlanilha: "CANETA METAL TOUCH", unidVend: 455579 },
        ],
      },
    ],
  },
  {
    slug: "chaveiros-mouse-pad-e-kit-executivo",
    label: "Chaveiros, Mouse Pad e Kit Executivo",
    categorias: [
      {
        slug: "chaveiros",
        label: "Chaveiros",
        itens: [
          { posicao: 1, codigoPai: "9824", codigoPrefixo: "09824", nomePlanilha: "CHAVEIRO METAL ABRIDOR", unidVend: 2453326 },
          { posicao: 2, codigoPai: "1955", codigoPrefixo: "01955", nomePlanilha: "CHAVEIRO METAL RETANGULAR", unidVend: 724847 },
          { posicao: 3, codigoPai: "5691", codigoPrefixo: "05691", nomePlanilha: "CHAVEIRO ABRIDOR DE GARRAFA", unidVend: 610691 },
          { posicao: 4, codigoPai: "1655", codigoPrefixo: "01655", nomePlanilha: "CHAVEIRO DE METAL REDONDO", unidVend: 279938 },
          { posicao: 5, codigoPai: "12191-CAIXINHA", codigoPrefixo: "12191", nomePlanilha: "CHAVEIRO DE METAL RETANGULAR", unidVend: 258390 },
          { posicao: 6, codigoPai: "10201", codigoPrefixo: "10201", nomePlanilha: "CHAVEIRO PLAQUINHA EM METAL -PRA", unidVend: 220426 },
          { posicao: 7, codigoPai: "10200", codigoPrefixo: "10200", nomePlanilha: "CHAVEIRO PLAQUINHA FORMATO CASA", unidVend: 195227 },
          { posicao: 8, codigoPai: "8232", codigoPrefixo: "08232", nomePlanilha: "CHAVEIRO TRENA PLÁSTICO 2 METROS", unidVend: 186863 },
          { posicao: 9, codigoPai: "10415-BRILHANTE", codigoPrefixo: "10415", nomePlanilha: "TRENA CHAVEIRO PNEU BRILHANTE", unidVend: 141211 },
          { posicao: 10, codigoPai: "06085B", codigoPrefixo: "06085B", nomePlanilha: "CHAVEIRO CAPACETE EPI", unidVend: 140237 },
        ],
      },
      {
        slug: "mouse-pad",
        label: "Mouse Pad",
        itens: [
          { posicao: 1, codigoPai: "1812", codigoPrefixo: "01812", nomePlanilha: "MOUSE PAD", unidVend: 238165 },
          { posicao: 2, codigoPai: "3007", codigoPrefixo: "03007", nomePlanilha: "MOUSE PAD ERGONÔMICO", unidVend: 124731 },
          { posicao: 3, codigoPai: "03007B", codigoPrefixo: "03007B", nomePlanilha: "MOUSE PAD ERGONÔMICO", unidVend: 97241 },
          { posicao: 4, codigoPai: "1810", codigoPrefixo: "01810", nomePlanilha: "MOUSE PAD C/ ALMOFADA", unidVend: 72349 },
          { posicao: 5, codigoPai: "14119", codigoPrefixo: "14119", nomePlanilha: "MOUSE PAD NEOPREME RETANGULAR", unidVend: 45285 },
          { posicao: 6, codigoPai: "14120", codigoPrefixo: "14120", nomePlanilha: "MOUSE PAD NEOPREME REDONDO", unidVend: 25862 },
          { posicao: 7, codigoPai: "19069", codigoPrefixo: "19069", nomePlanilha: "MOUSE PAD POLIÉSTER", unidVend: 16707 },
          { posicao: 8, codigoPai: "7056", codigoPrefixo: "07056", nomePlanilha: "MOUSE PAD COURO SINTÉTICO", unidVend: 13569 },
          { posicao: 9, codigoPai: "01810A", codigoPrefixo: "01810A", nomePlanilha: "MOUSE PAD ERGONÔMICO", unidVend: 10879 },
          { posicao: 10, codigoPai: "8151", codigoPrefixo: "08151", nomePlanilha: "MOUSE PAD", unidVend: 10657 },
        ],
      },
      {
        slug: "kit-executivo",
        label: "Kit Executivo",
        itens: [
          { posicao: 1, codigoPai: "7048", codigoPrefixo: "07048", nomePlanilha: "KIT EXECUTIVO ECOLÓGICO 3 PEÇAS", unidVend: 36437 },
          { posicao: 2, codigoPai: "07048B", codigoPrefixo: "07048B", nomePlanilha: "KIT EXECUTIVO ECOLÓGICO 3 PEÇAS", unidVend: 29237 },
          { posicao: 3, codigoPai: "8254", codigoPrefixo: "08254", nomePlanilha: "KIT EXECUTIVO 2 PEÇAS", unidVend: 20786 },
          { posicao: 4, codigoPai: "19029", codigoPrefixo: "19029", nomePlanilha: "KIT EXECUTIVO 2 PEÇAS", unidVend: 18801 },
          { posicao: 5, codigoPai: "19030", codigoPrefixo: "19030", nomePlanilha: "KIT EXECUTIVO 3 PEÇAS -PRE", unidVend: 12047 },
          { posicao: 6, codigoPai: "8255", codigoPrefixo: "08255", nomePlanilha: "KIT EXECUTIVO 2 PEÇAS", unidVend: 11336 },
          { posicao: 7, codigoPai: "19013", codigoPrefixo: "19013", nomePlanilha: "KIT EXECUTIVO 2 PEÇAS", unidVend: 10726 },
          { posicao: 8, codigoPai: "1988", codigoPrefixo: "01988", nomePlanilha: "KIT EXECUTIVO", unidVend: 9573 },
          { posicao: 9, codigoPai: "19143", codigoPrefixo: "19143", nomePlanilha: "KIT EXECUTIVO 2 PEÇAS", unidVend: 6103 },
          { posicao: 10, codigoPai: "18836", codigoPrefixo: "18836", nomePlanilha: "KIT EXECUTIVO ECOLÓGICO 3 PEÇAS", unidVend: 5255 },
        ],
      },
    ],
  },
  {
    slug: "caixas-de-som-fones-e-power-bank",
    label: "Caixas de Som, Fones e Power Bank",
    categorias: [
      {
        slug: "caixas-de-som",
        label: "Caixas de Som",
        itens: [
          { posicao: 1, codigoPai: "6029", codigoPrefixo: "06029", nomePlanilha: "CAIXA DE SOM BLUETOOTH TWS", unidVend: 20692 },
          { posicao: 2, codigoPai: "4067", codigoPrefixo: "04067", nomePlanilha: "CAIXA DE SOM COM LUMINÁRIA -BCO", unidVend: 20602 },
          { posicao: 3, codigoPai: "4362", codigoPrefixo: "04362", nomePlanilha: "CAIXA DE SOM MULTIMÍDIA", unidVend: 16184 },
          { posicao: 4, codigoPai: "8003", codigoPrefixo: "08003", nomePlanilha: "CAIXA DE SOM BLUETOOTH TWS -PRE", unidVend: 11344 },
          { posicao: 5, codigoPai: "8002", codigoPrefixo: "08002", nomePlanilha: "CAIXA DE SOM BLUETOOTH TWS", unidVend: 10790 },
          { posicao: 6, codigoPai: "6093", codigoPrefixo: "06093", nomePlanilha: "CAIXA DE SOM COM CARREGADOR INDUÇÃO -BCO", unidVend: 5617 },
          { posicao: 7, codigoPai: "4065", codigoPrefixo: "04065", nomePlanilha: "CAIXA DE SOM MULTIMÍDIA COM RELÓGIO", unidVend: 5207 },
          { posicao: 8, codigoPai: "2070", codigoPrefixo: "02070", nomePlanilha: "CAIXA DE SOM MULTIMÍDIA", unidVend: 5101 },
          { posicao: 9, codigoPai: "8021", codigoPrefixo: "08021", nomePlanilha: "CAIXA DE SOM MULTIMÍDIA TWS -PRE", unidVend: 3987 },
          { posicao: 10, codigoPai: "8004", codigoPrefixo: "08004", nomePlanilha: "CAIXA DE SOM BLUETOOTH TWS", unidVend: 3702 },
        ],
      },
      {
        slug: "fones-de-ouvido",
        label: "Fones de Ouvido",
        itens: [
          { posicao: 1, codigoPai: "12789", codigoPrefixo: "12789", nomePlanilha: "FONE DE OUVIDO C/ MICROFONE -BCO/BCO", unidVend: 170247 },
          { posicao: 2, codigoPai: "5021", codigoPrefixo: "05021", nomePlanilha: "FONE BLUETOOTH C/ CARREGADOR", unidVend: 80278 },
          { posicao: 3, codigoPai: "P@18596", codigoPrefixo: "P@18596", nomePlanilha: "FONE BLUETOOTH C/ CARREGADOR", unidVend: 65925 },
          { posicao: 4, codigoPai: "6064", codigoPrefixo: "06064", nomePlanilha: "FONE DE OUVIDO BLUETOOTH TOUCH COM CASE CARREGADOR", unidVend: 39526 },
          { posicao: 5, codigoPai: "8120", codigoPrefixo: "08120", nomePlanilha: "FONE DE OUVIDO BLUETOOTH TOUCH COM CASE CARREGADOR", unidVend: 33609 },
          { posicao: 6, codigoPai: "5048", codigoPrefixo: "05048", nomePlanilha: "FONE DE OUVIDO BLUETOOTH", unidVend: 22517 },
          { posicao: 7, codigoPai: "12614", codigoPrefixo: "12614", nomePlanilha: "FONE DE OUVIDO STEREO HD", unidVend: 15566 },
          { posicao: 8, codigoPai: "02068-FOS", codigoPrefixo: "02068", nomePlanilha: "FONE DE OUVIDO WIRELESS P2 FOSCO", unidVend: 13842 },
          { posicao: 9, codigoPai: "6389", codigoPrefixo: "06389", nomePlanilha: "FONE DE OUVIDO BLUETOOTH COM CASE CARREGADOR", unidVend: 8903 },
          { posicao: 10, codigoPai: "13474", codigoPrefixo: "13474", nomePlanilha: "FONE DE OUVIDO WIRELESS", unidVend: 7387 },
        ],
      },
      {
        slug: "power-banks",
        label: "Power Banks",
        itens: [
          { posicao: 1, codigoPai: "4052", codigoPrefixo: "04052", nomePlanilha: "POWER BANK 10.000MAH MULTISSAÍDAS", unidVend: 29337 },
          { posicao: 2, codigoPai: "6052", codigoPrefixo: "06052", nomePlanilha: "POWER BANK 10.000MAH COM CARREGAMENTO VIA INDUÇÃO OU VIA CABO", unidVend: 26983 },
          { posicao: 3, codigoPai: "8014", codigoPrefixo: "08014", nomePlanilha: "POWER BANK 10.000MAH COM LANTERNA E MULTISSAÍDAS -BCO", unidVend: 15630 },
          { posicao: 4, codigoPai: "5089", codigoPrefixo: "05089", nomePlanilha: "POWER BANK PLÁSTICO 5.000MAH", unidVend: 14827 },
          { posicao: 5, codigoPai: "9145", codigoPrefixo: "09145", nomePlanilha: "POWER BANK 10.000MAH COM CARREGAMENTO VIA INDUÇÃO OU VIA CABO", unidVend: 14684 },
          { posicao: 6, codigoPai: "8219", codigoPrefixo: "08219", nomePlanilha: "POWER BANK 10.000MAH MULTISSAÍDAS", unidVend: 13496 },
          { posicao: 7, codigoPai: "4051", codigoPrefixo: "04051", nomePlanilha: "POWER BANK 10.000MAH C/ INDUÇÃO", unidVend: 12900 },
          { posicao: 8, codigoPai: "8188", codigoPrefixo: "08188", nomePlanilha: "POWER BANK 10.000MAH COM INDICADOR LED", unidVend: 11314 },
          { posicao: 9, codigoPai: "8011", codigoPrefixo: "08011", nomePlanilha: "POWER BANK 10.000MAH C/ LANTERNA E MULTISSAÍDAS", unidVend: 11206 },
          { posicao: 10, codigoPai: "4050", codigoPrefixo: "04050", nomePlanilha: "POWER BANK 8000MAH C/ INDUÇÃO", unidVend: 7484 },
        ],
      },
    ],
  },
  {
    slug: "sacola-de-algodao-e-tnt",
    label: "Sacola de Algodão e Tnt",
    categorias: [
      {
        slug: "sacolas-de-algodao-e-tnt",
        label: "Sacolas de Algodão e TNT",
        itens: [
          { posicao: 1, codigoPai: "18537G", codigoPrefixo: "18537G", nomePlanilha: "SACOLA EM TNT REVESTIDA C/ PLASTICO", unidVend: 641669 },
          { posicao: 2, codigoPai: "13780", codigoPrefixo: "13780", nomePlanilha: "SACOLA TNT COM ALÇA", unidVend: 638097 },
          { posicao: 3, codigoPai: "13803N", codigoPrefixo: "13803N", nomePlanilha: "SACOLA DE ALGODÃO", unidVend: 606587 },
          { posicao: 4, codigoPai: "13780N", codigoPrefixo: "13780N", nomePlanilha: "SACOLA DE TNT", unidVend: 585598 },
          { posicao: 5, codigoPai: "18537P", codigoPrefixo: "18537P", nomePlanilha: "SACOLA EM TNT REVESTIDA C/ PLASTICO", unidVend: 505925 },
          { posicao: 6, codigoPai: "13781N", codigoPrefixo: "13781N", nomePlanilha: "SACOLA DE TNT", unidVend: 384814 },
          { posicao: 7, codigoPai: "13803B", codigoPrefixo: "13803B", nomePlanilha: "SACOLA DE ALGODÃO", unidVend: 185102 },
          { posicao: 8, codigoPai: "4399", codigoPrefixo: "04399", nomePlanilha: "SACOLA DE ALGODÃO", unidVend: 154562 },
          { posicao: 9, codigoPai: "13781I", codigoPrefixo: "13781I", nomePlanilha: "SACOLA TNT", unidVend: 135934 },
          { posicao: 10, codigoPai: "15016", codigoPrefixo: "15016", nomePlanilha: "SACOLA DE TNT", unidVend: 113554 },
        ],
      },
    ],
  },
  {
    slug: "kit-churrasco-e-kit-vinho",
    label: "Kit Churrasco e Kit Vinho",
    categorias: [
      {
        slug: "kit-churrasco",
        label: "Kit Churrasco",
        itens: [
          { posicao: 1, codigoPai: "7447", codigoPrefixo: "07447", nomePlanilha: "KIT CHURRASCO NO ESTOJO C/ 2 PÇS", unidVend: 434959 },
          { posicao: 2, codigoPai: "7443", codigoPrefixo: "07443", nomePlanilha: "KIT CHURRASCO 2 PEÇAS", unidVend: 116012 },
          { posicao: 3, codigoPai: "07447B", codigoPrefixo: "07447B", nomePlanilha: "KIT CHURRASCO 2 PEÇAS", unidVend: 44749 },
          { posicao: 4, codigoPai: "12089", codigoPrefixo: "12089", nomePlanilha: "KIT TALHERES P/ CHURRASCO C/ 8 PEÇAS", unidVend: 43643 },
          { posicao: 5, codigoPai: "1644", codigoPrefixo: "01644", nomePlanilha: "KIT CHURRASCO NA MALETA 4 PEÇAS", unidVend: 31811 },
          { posicao: 6, codigoPai: "1035", codigoPrefixo: "01035", nomePlanilha: "KIT CHURRASCO 4 PEÇAS", unidVend: 31224 },
          { posicao: 7, codigoPai: "2250", codigoPrefixo: "02250", nomePlanilha: "KIT CHURRASCO 5 PEÇAS -PRE", unidVend: 22278 },
          { posicao: 8, codigoPai: "8096", codigoPrefixo: "08096", nomePlanilha: "KIT CHURRASCO 7 PEÇAS", unidVend: 18862 },
          { posicao: 9, codigoPai: "18891", codigoPrefixo: "18891", nomePlanilha: "KIT CHURRASCO 3 PEÇAS", unidVend: 14375 },
          { posicao: 10, codigoPai: "05184B", codigoPrefixo: "05184B", nomePlanilha: "KIT CHURRASCO 8 PEÇAS", unidVend: 13814 },
        ],
      },
      {
        slug: "kit-vinho",
        label: "Kit Vinho",
        itens: [
          { posicao: 1, codigoPai: "18621", codigoPrefixo: "18621", nomePlanilha: "SACA ROLHAS", unidVend: 56276 },
          { posicao: 2, codigoPai: "10071G", codigoPrefixo: "10071G", nomePlanilha: "KIT VINHO CAIXA DE PAPELÃO 2 PEÇAS", unidVend: 51327 },
          { posicao: 3, codigoPai: "3493", codigoPrefixo: "03493", nomePlanilha: "KIT VINHO P/ 1 GARRAFA", unidVend: 37199 },
          { posicao: 4, codigoPai: "11871", codigoPrefixo: "11871", nomePlanilha: "KIT VINHO PLÁSTICO RESISTENTE 3 PEÇAS FORMATO GARRAFA", unidVend: 21623 },
          { posicao: 5, codigoPai: "11870", codigoPrefixo: "11870", nomePlanilha: "KIT VINHO 5PÇS FORMATO GARRAFA", unidVend: 21031 },
          { posicao: 6, codigoPai: "12046", codigoPrefixo: "12046", nomePlanilha: "KIT VINHO XADREZ 4 PÇS", unidVend: 13047 },
          { posicao: 7, codigoPai: "10071", codigoPrefixo: "10071", nomePlanilha: "KIT VINHO CAIXA DE PAPELÃO 2 PEÇAS  -PRE", unidVend: 12127 },
          { posicao: 8, codigoPai: "3494", codigoPrefixo: "03494", nomePlanilha: "KIT VINHO P/ 2 GARRAFAS", unidVend: 11965 },
          { posicao: 9, codigoPai: "10695", codigoPrefixo: "10695", nomePlanilha: "SACA ROLHAS METÁLICO", unidVend: 11532 },
          { posicao: 10, codigoPai: "8148", codigoPrefixo: "08148", nomePlanilha: "PORTA VINHO DE PU", unidVend: 11326 },
        ],
      },
    ],
  },
  {
    slug: "marmitas-e-tabuas-de-madeira",
    label: "Marmitas e Tábuas de Madeira",
    categorias: [
      {
        slug: "marmitas",
        label: "Marmitas",
        itens: [
          { posicao: 1, codigoPai: "6090", codigoPrefixo: "06090", nomePlanilha: "MARMITA DUPLA FIBRA BAMBU", unidVend: 39934 },
          { posicao: 2, codigoPai: "6089", codigoPrefixo: "06089", nomePlanilha: "MARMITA FIBRA TRIGO", unidVend: 26181 },
          { posicao: 3, codigoPai: "18857", codigoPrefixo: "18857", nomePlanilha: "MARMITA HERMÉTICA DE PALHA DE TRIGO", unidVend: 20221 },
          { posicao: 4, codigoPai: "8061", codigoPrefixo: "08061", nomePlanilha: "MARMITA HERMÉTICA 1 LITRO -ACN", unidVend: 10071 },
          { posicao: 5, codigoPai: "18858", codigoPrefixo: "18858", nomePlanilha: "MARMITA HERMÉTICA PLÁSTICA 1L -MAR", unidVend: 7635 },
          { posicao: 6, codigoPai: "18856", codigoPrefixo: "18856", nomePlanilha: "MARMITA PALHA DE TRIGO 3 DIV.", unidVend: 5714 },
          { posicao: 7, codigoPai: "9206", codigoPrefixo: "09206", nomePlanilha: "MARMITA VIDRO 600ML", unidVend: 5005 },
          { posicao: 8, codigoPai: "7028", codigoPrefixo: "07028", nomePlanilha: "MARMITA HERMÉTICA 800ML", unidVend: 3322 },
          { posicao: 9, codigoPai: "8060", codigoPrefixo: "08060", nomePlanilha: "MARMITA HERMÉTICA 1,2L -BEG", unidVend: 3124 },
          { posicao: 10, codigoPai: "18947", codigoPrefixo: "18947", nomePlanilha: "MARMITA DUPLA PLÁSTICA", unidVend: 2977 },
        ],
      },
      {
        slug: "tabuas-e-petisqueiras",
        label: "Tábuas e Petisqueiras",
        itens: [
          { posicao: 1, codigoPai: "18584B", codigoPrefixo: "18584B", nomePlanilha: "TÁBUA DE CORTE COM CANALETA", unidVend: 51111 },
          { posicao: 2, codigoPai: "18591B", codigoPrefixo: "18591B", nomePlanilha: "TÁBUA DE CORTE COM CANALETA", unidVend: 22617 },
          { posicao: 3, codigoPai: "18583", codigoPrefixo: "18583", nomePlanilha: "TÁBUA DE CORTE C/ CANALETA  28X22", unidVend: 19912 },
          { posicao: 4, codigoPai: "18592", codigoPrefixo: "18592", nomePlanilha: "TÁBUA DE CORTE C/  CANALETA  33X24", unidVend: 10622 },
          { posicao: 5, codigoPai: "18599", codigoPrefixo: "18599", nomePlanilha: "TÁBUA DE CORTE COM CANALETA 34X24", unidVend: 8810 },
          { posicao: 6, codigoPai: "18587", codigoPrefixo: "18587", nomePlanilha: "TÁBUA DE CORTE", unidVend: 6558 },
          { posicao: 7, codigoPai: "18664P", codigoPrefixo: "18664P", nomePlanilha: "TÁBUA REDONDA PEQUENA", unidVend: 6049 },
          { posicao: 8, codigoPai: "18629", codigoPrefixo: "18629", nomePlanilha: "KIT QUEIJO 2 PEÇAS + TÁBUA REDONDA", unidVend: 5518 },
          { posicao: 9, codigoPai: "18608", codigoPrefixo: "18608", nomePlanilha: "TÁBUA P/ CORTE C/ CANALETA 30*40CM", unidVend: 5435 },
          { posicao: 10, codigoPai: "18600", codigoPrefixo: "18600", nomePlanilha: "TÁBUA DE CORTE COM ALÇA", unidVend: 5121 },
        ],
      },
    ],
  },
  {
    slug: "guarda-chuvas",
    label: "Guarda-Chuvas",
    categorias: [
      {
        slug: "guarda-chuvas",
        label: "Guarda-Chuvas",
        itens: [
          { posicao: 1, codigoPai: "2075", codigoPrefixo: "02075", nomePlanilha: "GUARDA-CHUVA", unidVend: 40364 },
          { posicao: 2, codigoPai: "5198", codigoPrefixo: "05198", nomePlanilha: "GUARDA-CHUVA MANUAL", unidVend: 19065 },
          { posicao: 3, codigoPai: "5044", codigoPrefixo: "05044", nomePlanilha: "GUARDA-CHUVA AUTOMÁTICO", unidVend: 18967 },
          { posicao: 4, codigoPai: "2078", codigoPrefixo: "02078", nomePlanilha: "GUARDA-CHUVA INVERTIDO", unidVend: 15268 },
          { posicao: 5, codigoPai: "5045", codigoPrefixo: "05045", nomePlanilha: "GUARDA-CHUVA MANUAL COM PROTEÇÃO UV", unidVend: 10472 },
          { posicao: 6, codigoPai: "6063", codigoPrefixo: "06063", nomePlanilha: "GUARDA-CHUVA AUTOMÁTICO", unidVend: 10252 },
          { posicao: 7, codigoPai: "8338", codigoPrefixo: "08338", nomePlanilha: "GUARDA-CHUVA", unidVend: 9743 },
          { posicao: 8, codigoPai: "18680", codigoPrefixo: "18680", nomePlanilha: "GUARDA-CHUVA TRANSPARENTE", unidVend: 9639 },
          { posicao: 9, codigoPai: "5046", codigoPrefixo: "05046", nomePlanilha: "GUARDA-CHUVA", unidVend: 7649 },
          { posicao: 10, codigoPai: "5197", codigoPrefixo: "05197", nomePlanilha: "GUARDA-CHUVA MANUAL", unidVend: 7349 },
        ],
      },
    ],
  },
];

export const TOP10_TODAS_CATEGORIAS = TOP10_SECOES.flatMap((s) =>
  s.categorias.map((c) => ({ ...c, secaoSlug: s.slug, secaoLabel: s.label }))
);

export const TOP10_PREFIXOS = Array.from(
  new Set(TOP10_TODAS_CATEGORIAS.flatMap((c) => c.itens.map((i) => i.codigoPrefixo)))
);
