/**
 * The long-form page: what twenty-eight countries actually charge to register an imported
 * car, and the places where the tables everybody quotes stopped being law years ago.
 *
 * It exists because the research is the most valuable thing this project has and it was
 * invisible — every finding sat in a private file while the site showed only the numbers
 * that came out of it. Prose only: the table of twenty-eight is built by the prerender
 * from `config/countries.json`, so the article and the calculator cannot drift apart.
 *
 * Every claim here is one already carried by the config, with the law that produced it.
 *
 * It lives in scripts/ so that not one word of it reaches the bundle a visitor downloads.
 */

import { NOTE_PATH } from '../src/lib/pages.ts'

export type Section = { heading: string; body: string[] }

export const note = {
  slug: NOTE_PATH,
  title: 'What {destinations} countries actually charge to register an imported car',
  description:
    'Registration tax in Ukraine, the 27 EU states and the three countries outside it, traced to the law in each one — including the countries where the tables everybody quotes stopped being law years ago.',
  lead: [
    'A friend in Ukraine had an Audi A4 and nobody could say what bringing it to Spain would cost. Every guide on the internet gives a number. Almost none of them gives the law it came from, and a surprising share of them are quoting text that was repealed years ago.',
    'So we read the laws — {destinations} of them, one country at a time, an official source or nothing. This is what is actually charged, and the six places where the answer everyone repeats is wrong.',
  ],
  sections: [
    {
      heading: 'Belgium is three countries wearing one flag',
      body: [
        'Article 101 of the Code des taxes assimilées aux impôts sur les revenus ties the tax to the address on the registration certificate. Not where the car is bought, not where it is inspected — where the owner lives. Belgium then has three completely different taxes behind that one rule.',
        'Flanders runs a formula with a technology coefficient that rises every year (1.245 in 2026), an emission-standard amount, and an age correction. Wallonia takes a base from engine power and multiplies it by CO₂ over 136, by full mass over 1 838, and by a fuel coefficient. Brussels ignores CO₂ altogether and charges on fiscal horsepower and age.',
        'The same 2017 Audi A4: <strong>€276 in Flanders, €2 427 in Wallonia</strong>. The two are an hour apart by car. This is why the calculator asks which region you live in before it will give a Belgian answer, and why it still refuses to give a Brussels one — that grid is statutory but indexed every July since 2024, and the indexed table is published nowhere we could reach.',
      ],
    },
    {
      heading: 'Greece stopped taxing engine size in 2016',
      body: [
        'Search for Greek registration tax and you will find coefficient tables by cylinder capacity, chosen by which emission Directive the car meets. Those tables are real. They are also dead law, and have been for a decade.',
        'Article 59 of law 4389/2016 replaced article 121 §2 of law 2960/2001 outright, with a scale on the taxable value instead: 4% to €14 000, then 8, 16, 24 and 32% above €25 000. That is lifted by CO₂ — minus 5% below 100 g/km, rising to plus 100% above 250 — and lifted again where the car is behind the current emission standard, by 50% one step back, 200% further, and 500% for conventional technology over 250 g/km.',
        'AADE publishes an applied grid that multiplies out to exactly those numbers — 3.80, 4.00, 4.40% and so on for the cheapest bracket — which is what confirms the reading. Hybrids pay half; pure electric cars are outside the tax entirely.',
      ],
    },
    {
      heading: 'Cyprus abolished its car excise, and the internet did not notice',
      body: [
        'Every secondary source we found says Cyprus replaced its excise duty on cars with a one-off surcharge by euro standard and fuel. It did not.',
        'Law 39(I)/2019 rewrote the Fourth Schedule of the Excise Duties Law 91(I)/2004 so that headings 8703.21 to 8703.90 read <strong>«Ατελώς»</strong> — duty-free. The consolidated text, with amendments through 2026, still says so. The CO₂-based charge that is easy to find is the annual road tax, which is a different thing entirely.',
        'The Cypriot transport ministry’s own site is literally under construction, so the text comes from cylaw.org, the public repository of the Gazette. Cyprus charges nothing at registration, and the calculator says so.',
      ],
    },
    {
      heading: 'Slovenia’s law and Slovenia’s bill are different documents',
      body: [
        'Slovenia stopped charging a percentage of the price in 2021. ZDMV-1 replaced it with three separate tables — CO₂ with fuel, engine power, and euro standard — added together and then reduced for the age of the car.',
        'Every figure we first collected came from the 2020 bill, because pisrs.si and uradni-list.si serve empty shells to anything that is not a browser with JavaScript. When the enacted text was finally read (Uradni list RS 200/2020, cross-checked against FURS guidance of 5 September 2025), the CO₂ bands, the power bands, the euro-standard amounts and the age table were all different. Only the NEDC-to-WLTP conversion factors survived unchanged.',
        'If you are quoting Slovenian rates from anything published before the law came into force, they are wrong in almost every number.',
      ],
    },
    {
      heading: 'Finland has no zero rate for electric cars',
      body: [
        'The consolidated Autoverolaki 777/2020 carries table 1 A, one row per gram of CO₂ from zero to “360 or more”. At 0 g/km the rate is <strong>2.7%</strong>, not nothing. An electric car in Finland pays car tax; it simply lands on the lowest row.',
        'The second thing the table settles: 44.8% belongs to 300 g/km, not to 250, which is where several widely-copied summaries put it.',
      ],
    },
    {
      heading: 'Croatia tells you your invoice is irrelevant, in writing',
      body: [
        'The Croatian customs administration’s own FAQ: “Neovisno gdje je rabljeno motorno vozilo kupljeno i koliko je za njega plaćeno, Carinska uprava će u svim slučajevima utvrđivati tržišnu vrijednost rabljenog motornog vozila na hrvatskom tržištu.” Regardless of where the used car was bought and how much was paid for it, customs will in all cases determine its market value on the Croatian market.',
        'That is the honest shape of a problem six countries share. Denmark values the car against comparable Danish cars, Ireland uses Revenue’s OMSP, Malta uses a registration value Transport Malta assigns, Finland uses the Finnish retail value, Greece uses the price of the equivalent new Greek car. None of that is derivable from a foreign purchase price — and in each of those countries the domestic price already contains the tax, so using it as a proxy would not be a rough answer but a wrong one.',
        'We compute those six anyway, at the country’s exact statutory rates but on the price paid, and every one of those lines carries a warning in red saying exactly that. They read as floors, not as answers.',
      ],
    },
    {
      heading: 'Estonia publishes a working API but not its rates',
      body: [
        'Estonia has charged a registration fee since 1 January 2025 — a base part plus CO₂ and mass parts, times an age coefficient. The rates are in the law on riigiteataja.ee, which serves an Angular shell; the ministry’s draft figures do not match what is actually charged.',
        'What does work is the register’s own calculator API. It takes the vehicle category, WLTP CO₂, maximum laden mass, first registration date and seat count as a plain GET, needs no key, and answers a browser cross-origin. So Estonia is the one country the calculator does not reproduce: it asks the authority and prints the authority’s answer.',
      ],
    },
    {
      heading: 'The Netherlands taxes CO₂, and the price never enters it',
      body: [
        'Dutch BPM is not a percentage of what you paid. It is a fixed amount plus a per-gram rate from the 2026 brackets — €687 plus €2 a gram up to 77 g/km, rising to €14 538 plus €594 a gram above 155 — plus €114.83 for every diesel gram above 69.',
        'A used import is then written down by the official depreciation table, by months since first registration: 33% at nine months, 62% at five and a half years, 81% at nine and a half. It is due on the first Dutch plate whatever the origin, other EU countries included. Two identical cars bought for very different money owe exactly the same BPM.',
      ],
    },
    {
      heading: 'Three zeros that turned out to be real',
      body: [
        'Luxembourg, Sweden and Latvia were inherited as “no registration tax” from an early draft and nobody had checked them. All three hold up, for three different reasons.',
        'Luxembourg charges a €50 chancellery fee and an annual road tax, and nothing at registration. Sweden’s malus is an <em>elevated annual</em> vehicle tax for the first three years, never a lump sum. Latvia’s CO₂ levy is the annual operating tax, merely pro-rated for the remaining months when the car is registered.',
        'Czechia is the counter-example worth knowing: it looks like a zero and is not. It charges an emission fee once, on the first registration of an import — 3 000 CZK for EURO 2, 5 000 for EURO 1, 10 000 for no standard, nothing from EURO 3 up. Most cars pay nothing, which is exactly how a country ends up wrongly filed as free.',
      ],
    },
    {
      heading: 'Switzerland charges no customs duty, and almost every source says otherwise',
      body: [
        'Switzerland abolished its industrial tariffs — chapters 25 to 97 of the tariff, which is where cars live — on 1 January 2024. The Generaltarif now reads 0.00 on every line of heading 8703. The CHF 12–15 per 100 kg of gross weight that forums, brokers and half the import guides still quote has been dead law for two years.',
        'What is left is the 4% automobile tax and 8.1% VAT charged on the price plus that tax, which compounds to exactly 12.424% of what you paid and nothing else at federal level. Both run off the invoice — a Swiss market value is used only where there is no sale at all, a gift or an inheritance — so Switzerland is one of the countries we can compute to the franc.',
      ],
    },
    {
      heading: 'Norway’s tax is the largest in Europe and the most certain',
      body: [
        'The engangsavgift is charged on kerb weight and CO₂, and never on what the car cost. A 1 600 kg petrol car at 168 g/km owes 335 581 kroner as new. Nothing a seller writes on an invoice changes it.',
        '2026 rewrote the whole thing, so every table published before that January is wrong: the NOx component is abolished, engine power and displacement no longer appear for cars, and the tax-free CO₂ allowance is gone — the first gram now costs money. Where no CO₂ is certified, the law derives one as the kerb weight divided by ten rather than falling back to displacement.',
        'The age deduction is what makes Norway survivable: it reaches 100% at twenty years, so an old car pays nothing at all. And customs duty is zero from everywhere — the tariff reads 0.00 on every car line.',
      ],
    },
    {
      heading: 'A used import into Britain does not pay the “showroom tax”',
      body: [
        'The United Kingdom has no registration tax. What everyone calls the showroom tax is the rate of the *first* annual licence, and section 62(1C) of the Vehicle Excise and Registration Act says there is no first vehicle licence at all where the car was registered abroad more than six months ago **and** has covered more than 6 000 kilometres.',
        'Both limbs, which is the trap. A four-month-old car with 20 000 km still pays the CO₂ table, and so does a two-year-old car with 3 000 km — and that table reaches £5 690. Get it right and an ordinary used import goes straight onto the £200 annual licence; get it wrong and you have understated the bill by thousands.',
        'Gov.uk’s own summary sentence — “you’ll pay a rate based on a vehicle’s CO2 emissions the first time it’s registered” — is written for new cars and does not carry the carve-out. The only authority is the Act itself.',
      ],
    },
    {
      heading: 'How this was checked',
      body: [
        'One country at a time, from the authority that levies the tax — a tax office, a customs administration, a vehicle register, or the law itself. Not a blog, not a dealer, not an aggregator. Where a figure could not be traced to such a source, no figure is shown.',
        'Every rate lives in a JSON file with the link to its source, and the calculator prints that link next to the line it produced. Nothing is invented, and where the honest answer is “this cannot be computed”, the page says that instead of guessing.',
        'It runs entirely in your browser. There is no account, no cookie for tracking, and no server holding your calculation.',
      ],
    },
  ] satisfies Section[],
}
