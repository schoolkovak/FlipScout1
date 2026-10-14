// Skill taxonomy. weight = Aced's ESTIMATED share of practice for each subskill within its section
// (sums to 1 per section). These are not official ACT frequencies; official reporting-category ranges are
// kept separately in `official`. conv is an ESTIMATE curve averaged from official Tests 1-3 (Test 4 is
// held back as an unseen final assessment) and applied to Aced tests, which are not officially equated.
window.ACED_DATA = window.ACED_DATA || {};
window.ACED_DATA.taxonomy = {
"subs": {
"e.punct.comma": {
"sec": "english",
"label": "Commas: nonessential elements, lists, clauses",
"cat": "CSE",
"weight": 0.13,
"diff": 3,
"t": 30,
"group": "Conventions of Standard English"
},
"e.punct.other": {
"sec": "english",
"label": "Semicolons, colons, dashes, apostrophes",
"cat": "CSE",
"weight": 0.1,
"diff": 3,
"t": 30,
"group": "Conventions of Standard English"
},
"e.sent.boundary": {
"sec": "english",
"label": "Sentence boundaries: fragments and run-ons",
"cat": "CSE",
"weight": 0.08,
"diff": 3,
"t": 30,
"group": "Conventions of Standard English"
},
"e.usage.agree": {
"sec": "english",
"label": "Agreement, verb tense, pronouns",
"cat": "CSE",
"weight": 0.08,
"diff": 3,
"t": 30,
"group": "Conventions of Standard English"
},
"e.kla.concise": {
"sec": "english",
"label": "Concision and redundancy",
"cat": "KLA",
"weight": 0.11,
"diff": 2,
"t": 25,
"group": "Knowledge of Language"
},
"e.kla.word": {
"sec": "english",
"label": "Precise word choice and tone",
"cat": "KLA",
"weight": 0.09,
"diff": 3,
"t": 30,
"group": "Knowledge of Language"
},
"e.pow.transition": {
"sec": "english",
"label": "Transitions and logical connections",
"cat": "POW",
"weight": 0.12,
"diff": 3,
"t": 35,
"group": "Production of Writing"
},
"e.pow.addel": {
"sec": "english",
"label": "Adding, deleting, or revising content",
"cat": "POW",
"weight": 0.13,
"diff": 3,
"t": 45,
"group": "Production of Writing"
},
"e.pow.org": {
"sec": "english",
"label": "Placement and organization",
"cat": "POW",
"weight": 0.08,
"diff": 4,
"t": 50,
"group": "Production of Writing"
},
"e.pow.purpose": {
"sec": "english",
"label": "Writer's purpose and essay goals",
"cat": "POW",
"weight": 0.08,
"diff": 4,
"t": 50,
"group": "Production of Writing"
},
"m.n.exponents": {
"sec": "math",
"label": "Exponents and radicals",
"cat": "N",
"weight": 0.045,
"diff": 2,
"t": 50,
"group": "Number & Quantity"
},
"m.n.real": {
"sec": "math",
"label": "Real number properties: rational/irrational, repeating decimals",
"cat": "N",
"weight": 0.025,
"diff": 3,
"t": 55,
"group": "Number & Quantity"
},
"m.n.complex": {
"sec": "math",
"label": "Complex numbers",
"cat": "N",
"weight": 0.025,
"diff": 3,
"t": 55,
"group": "Number & Quantity"
},
"m.n.vecmat": {
"sec": "math",
"label": "Vectors and matrices",
"cat": "N",
"weight": 0.015,
"diff": 3,
"t": 60,
"group": "Number & Quantity"
},
"m.a.linear": {
"sec": "math",
"label": "Linear equations and inequalities (incl. literal equations)",
"cat": "A",
"weight": 0.055,
"diff": 2,
"t": 55,
"group": "Algebra"
},
"m.a.abs": {
"sec": "math",
"label": "Absolute value equations and inequalities",
"cat": "A",
"weight": 0.015,
"diff": 3,
"t": 60,
"group": "Algebra"
},
"m.a.systems": {
"sec": "math",
"label": "Systems of equations",
"cat": "A",
"weight": 0.035,
"diff": 3,
"t": 70,
"group": "Algebra"
},
"m.a.poly": {
"sec": "math",
"label": "Polynomials: expanding, factoring, factor theorem",
"cat": "A",
"weight": 0.045,
"diff": 3,
"t": 65,
"group": "Algebra"
},
"m.a.radrat": {
"sec": "math",
"label": "Radical and rational equations",
"cat": "A",
"weight": 0.035,
"diff": 3,
"t": 70,
"group": "Algebra"
},
"m.f.notation": {
"sec": "math",
"label": "Function notation, composition, domain and range",
"cat": "F",
"weight": 0.04,
"diff": 3,
"t": 60,
"group": "Functions"
},
"m.f.inverse": {
"sec": "math",
"label": "Inverse functions",
"cat": "F",
"weight": 0.015,
"diff": 3,
"t": 55,
"group": "Functions"
},
"m.f.quad": {
"sec": "math",
"label": "Quadratic functions and graphs",
"cat": "F",
"weight": 0.035,
"diff": 3,
"t": 75,
"group": "Functions"
},
"m.f.explog": {
"sec": "math",
"label": "Exponential and logarithmic functions and models",
"cat": "F",
"weight": 0.035,
"diff": 3,
"t": 75,
"group": "Functions"
},
"m.f.transform": {
"sec": "math",
"label": "Function transformations",
"cat": "F",
"weight": 0.02,
"diff": 3,
"t": 65,
"group": "Functions"
},
"m.f.piecewise": {
"sec": "math",
"label": "Piecewise and rational functions (incl. asymptotes)",
"cat": "F",
"weight": 0.015,
"diff": 4,
"t": 75,
"group": "Functions"
},
"m.f.seq": {
"sec": "math",
"label": "Sequences and series",
"cat": "F",
"weight": 0.015,
"diff": 3,
"t": 65,
"group": "Functions"
},
"m.f.trig": {
"sec": "math",
"label": "Trigonometric functions: amplitude, period",
"cat": "F",
"weight": 0.01,
"diff": 4,
"t": 70,
"group": "Functions"
},
"m.g.area": {
"sec": "math",
"label": "Area, perimeter, and volume",
"cat": "G",
"weight": 0.045,
"diff": 3,
"t": 75,
"group": "Geometry"
},
"m.g.triangle": {
"sec": "math",
"label": "Triangles and angles: angle sums, side-angle relationships, special right triangles",
"cat": "G",
"weight": 0.03,
"diff": 3,
"t": 65,
"group": "Geometry"
},
"m.g.similar": {
"sec": "math",
"label": "Similarity and congruence",
"cat": "G",
"weight": 0.025,
"diff": 3,
"t": 65,
"group": "Geometry"
},
"m.g.circles": {
"sec": "math",
"label": "Circles: arcs, sectors, inscribed figures",
"cat": "G",
"weight": 0.015,
"diff": 3,
"t": 70,
"group": "Geometry"
},
"m.g.coord": {
"sec": "math",
"label": "Coordinate geometry: slope, distance, lines",
"cat": "G",
"weight": 0.03,
"diff": 2,
"t": 55,
"group": "Geometry"
},
"m.g.transform": {
"sec": "math",
"label": "Geometric transformations: translations, reflections, dilations",
"cat": "G",
"weight": 0.01,
"diff": 3,
"t": 60,
"group": "Geometry"
},
"m.g.trig": {
"sec": "math",
"label": "Right-triangle trigonometry",
"cat": "G",
"weight": 0.02,
"diff": 3,
"t": 65,
"group": "Geometry"
},
"m.g.conics": {
"sec": "math",
"label": "Conic sections: circles, parabolas, ellipses, hyperbolas",
"cat": "G",
"weight": 0.01,
"diff": 4,
"t": 70,
"group": "Geometry"
},
"m.s.prob": {
"sec": "math",
"label": "Probability: simple, compound, conditional",
"cat": "S",
"weight": 0.035,
"diff": 3,
"t": 65,
"group": "Statistics & Probability"
},
"m.s.count": {
"sec": "math",
"label": "Counting and sets",
"cat": "S",
"weight": 0.02,
"diff": 3,
"t": 55,
"group": "Statistics & Probability"
},
"m.s.expect": {
"sec": "math",
"label": "Expected value and probability distributions",
"cat": "S",
"weight": 0.015,
"diff": 3,
"t": 70,
"group": "Statistics & Probability"
},
"m.s.stats": {
"sec": "math",
"label": "Center, spread, and distributions (incl. normal)",
"cat": "S",
"weight": 0.03,
"diff": 3,
"t": 65,
"group": "Statistics & Probability"
},
"m.s.model": {
"sec": "math",
"label": "Statistical modeling: scatterplots, lines of fit, residuals",
"cat": "S",
"weight": 0.035,
"diff": 3,
"t": 70,
"group": "Statistics & Probability"
},
"m.ies.ratio": {
"sec": "math",
"label": "Rates, ratios, proportions, unit conversion",
"cat": "IES",
"weight": 0.07,
"diff": 2,
"t": 55,
"group": "Integrating Essential Skills"
},
"m.ies.percent": {
"sec": "math",
"label": "Percents and percent change",
"cat": "IES",
"weight": 0.045,
"diff": 2,
"t": 55,
"group": "Integrating Essential Skills"
},
"m.ies.express": {
"sec": "math",
"label": "Building expressions from word problems",
"cat": "IES",
"weight": 0.035,
"diff": 2,
"t": 55,
"group": "Integrating Essential Skills"
},
"m.ies.data": {
"sec": "math",
"label": "Reading tables and charts; basic averages",
"cat": "IES",
"weight": 0.025,
"diff": 1,
"t": 45,
"group": "Integrating Essential Skills"
},
"m.ies.geom": {
"sec": "math",
"label": "Basic measurement in context",
"cat": "IES",
"weight": 0.025,
"diff": 2,
"t": 55,
"group": "Integrating Essential Skills"
},
"r.kid.main": {
"sec": "reading",
"label": "Main idea and central claim",
"cat": "KID",
"weight": 0.12,
"diff": 3,
"t": 60,
"group": "Key Ideas & Details"
},
"r.kid.detail": {
"sec": "reading",
"label": "Locating supporting details",
"cat": "KID",
"weight": 0.19,
"diff": 2,
"t": 50,
"group": "Key Ideas & Details"
},
"r.kid.infer": {
"sec": "reading",
"label": "Inferences and implied meaning",
"cat": "KID",
"weight": 0.19,
"diff": 3,
"t": 70,
"group": "Key Ideas & Details"
},
"r.cs.vocab": {
"sec": "reading",
"label": "Words and phrases in context",
"cat": "CS",
"weight": 0.09,
"diff": 2,
"t": 45,
"group": "Craft & Structure"
},
"r.cs.purpose": {
"sec": "reading",
"label": "Purpose and function of a part",
"cat": "CS",
"weight": 0.13,
"diff": 3,
"t": 65,
"group": "Craft & Structure"
},
"r.cs.pov": {
"sec": "reading",
"label": "Point of view and author's tone",
"cat": "CS",
"weight": 0.08,
"diff": 3,
"t": 60,
"group": "Craft & Structure"
},
"r.iki.compare": {
"sec": "reading",
"label": "Comparing paired passages",
"cat": "IKI",
"weight": 0.1,
"diff": 4,
"t": 80,
"group": "Integration of Knowledge & Ideas"
},
"r.iki.claims": {
"sec": "reading",
"label": "Claims, evidence, and reasoning",
"cat": "IKI",
"weight": 0.1,
"diff": 3,
"t": 70,
"group": "Integration of Knowledge & Ideas"
},
"s.iod.read": {
"sec": "science",
"label": "Reading values from tables and graphs",
"cat": "IOD",
"weight": 0.26,
"diff": 2,
"t": 45,
"group": "Interpretation of Data"
},
"s.iod.trend": {
"sec": "science",
"label": "Trends, interpolation, extrapolation",
"cat": "IOD",
"weight": 0.22,
"diff": 3,
"t": 60,
"group": "Interpretation of Data"
},
"s.sin.design": {
"sec": "science",
"label": "Experimental design and controls",
"cat": "SIN",
"weight": 0.26,
"diff": 3,
"t": 65,
"group": "Scientific Investigation"
},
"s.emi.hyp": {
"sec": "science",
"label": "Hypotheses, models, and viewpoints",
"cat": "EMI",
"weight": 0.26,
"diff": 4,
"t": 75,
"group": "Evaluation of Models"
}
},
"cats": {
"POW": "Production of Writing",
"KLA": "Knowledge of Language",
"CSE": "Conventions of Standard English",
"A": "Algebra",
"F": "Functions",
"G": "Geometry",
"N": "Number & Quantity",
"S": "Statistics & Probability",
"IES": "Integrating Essential Skills",
"KID": "Key Ideas & Details",
"CS": "Craft & Structure",
"IKI": "Integration of Knowledge & Ideas",
"IOD": "Interpretation of Data",
"SIN": "Scientific Investigation",
"EMI": "Evaluation of Models, Inferences & Results"
},
"conv": {
"english": [
1,
2,
4,
5,
6,
7,
8,
9,
10,
10,
11,
11,
11,
12,
13,
14,
14,
15,
15,
16,
17,
18,
19,
20,
20,
21,
21,
22,
23,
23,
24,
25,
26,
27,
28,
30,
32,
34,
35,
35,
36
],
"math": [
1,
4,
7,
9,
10,
11,
12,
13,
14,
14,
14,
14,
15,
15,
16,
16,
16,
17,
17,
18,
18,
19,
20,
21,
22,
23,
24,
25,
26,
26,
27,
28,
28,
29,
30,
31,
32,
33,
34,
35,
36,
36
],
"reading": [
1,
3,
5,
7,
9,
10,
11,
11,
12,
13,
14,
15,
16,
17,
18,
20,
21,
22,
23,
24,
25,
27,
28,
30,
32,
34,
35,
36
],
"science": [
1,
3,
5,
7,
9,
10,
11,
11,
12,
13,
14,
15,
16,
17,
18,
18,
19,
20,
21,
22,
22,
23,
24,
24,
25,
26,
27,
27,
28,
29,
31,
32,
34,
35,
36
]
},
"official": {
"english": {
"source": "Official enhanced ACT blueprint",
"rows": [
[
"Production of Writing",
"38–43%"
],
[
"Knowledge of Language",
"18–23%"
],
[
"Conventions of Standard English",
"38–43%"
]
]
},
"math": {
"source": "Official enhanced ACT blueprint",
"rows": [
[
"Preparing for Higher Math",
"80%"
],
[
"  Number & Quantity",
"10–12%"
],
[
"  Algebra",
"17–20%"
],
[
"  Functions",
"17–20%"
],
[
"  Geometry",
"17–20%"
],
[
"  Statistics & Probability",
"12–15%"
],
[
"Integrating Essential Skills",
"20%"
],
[
"Modeling (overlaps the categories above)",
"≥20%"
]
]
},
"reading": {
"source": "Aced practice target (not an official ACT figure)",
"rows": [
[
"Key Ideas & Details",
"50%"
],
[
"Craft & Structure",
"30%"
],
[
"Integration of Knowledge & Ideas",
"20%"
]
]
},
"science": {
"source": "Aced estimate (no official percentages stored)",
"rows": [
[
"Interpretation of Data",
"48%"
],
[
"Scientific Investigation",
"26%"
],
[
"Evaluation of Models, Inferences & Results",
"26%"
]
]
}
}
};
