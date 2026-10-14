// Original Aced science passage (research summary with a graph and a table).
window.ACED_DATA = window.ACED_DATA || {};
(function (D) {
  D.units = D.units || {}; D.items = D.items || [];
  D.units.S1 = { id: 'S1', sec: 'science', label: 'Passage I', passage: `Catalase is an enzyme that speeds the breakdown of hydrogen peroxide (H₂O₂) into water and oxygen gas (O₂). Students studied how temperature and pH affect catalase activity.

**Experiment 1**

Equal volumes of a catalase solution and a 3% H₂O₂ solution, both at pH 7, were mixed at one of six temperatures. The volume of O₂ produced in 60 seconds was measured (see Figure 1).

{fig:Figure 1}

**Experiment 2**

The procedure of Experiment 1 was repeated at 37°C, but the pH of the solutions was varied (see Table 1).

{fig:Table 1}`, figures: [
    { id: 'Figure 1', type: 'line', x: { label: 'Temperature (°C)' }, y: { label: 'O₂ produced in 60 s (mL)', min: 0, max: 35 }, series: [{ name: 'pH 7', points: [[10, 8], [20, 15], [30, 24], [40, 29], [50, 18], [60, 4]] }] },
    { id: 'Table 1', type: 'table', columns: ['pH', 'O₂ produced in 60 s (mL)'], rows: [['3', '2'], ['5', '12'], ['7', '27'], ['9', '16'], ['11', '3']] }
  ] };
  const S = (n, o) => D.items.push(Object.assign({ id: `S1-${n}`, sec: 'science', unit: 'S1', n }, o));
  S(1, { q: 'According to Figure 1, at which temperature was the most O₂ produced?', c: ['20°C', '30°C', '40°C', '50°C'], a: 2, sub: 's.iod.read', cat: 'IOD', diff: 1, t: 30, e: 'The curve peaks at 29 mL at 40°C.', w: ['15 mL.', '24 mL.', '', '18 mL; activity is already falling.'], strat: 'Find the highest point on the curve and read straight down.' });
  S(2, { q: 'Based on Figure 1, as temperature increased from 10°C to 60°C, the volume of O₂ produced:', c: ['rose the whole time.', 'fell the whole time.', 'rose to a peak, then fell.', 'fell to a low point, then rose.'], a: 2, sub: 's.iod.trend', cat: 'IOD', diff: 2, t: 35, e: 'It rose from 8 mL to 29 mL at 40°C, then fell to 4 mL at 60°C.', w: ['Ignores the drop after 40°C.', 'Ignores the rise up to 40°C.', '', 'Reverses the shape.'], strat: 'Trace the whole range named in the question, not just the first few points.' });
  S(3, { q: 'If Experiment 1 had included a trial at 35°C, the volume of O₂ produced would most likely have been:', c: ['less than 15 mL.', 'between 15 mL and 24 mL.', 'between 24 mL and 29 mL.', 'greater than 29 mL.'], a: 2, sub: 's.iod.trend', cat: 'IOD', diff: 2, t: 40, e: '35°C lies between 30°C (24 mL) and 40°C (29 mL).', w: ['That range matches 10–20°C.', 'That range matches 20–30°C.', '', 'The maximum measured was 29 mL at 40°C.'], strat: 'Interpolate: find the two measured points on either side.' });
  S(4, { q: 'Which variable was held constant in Experiment 2 but varied in Experiment 1?', c: ['pH', 'Temperature', 'Volume of O₂ produced', 'Concentration of H₂O₂'], a: 1, sub: 's.sin.design', cat: 'SIN', diff: 3, t: 50, e: 'Experiment 2 was run at 37°C only; Experiment 1 varied temperature.', w: ['pH was varied in Experiment 2.', '', 'O₂ volume was the measured result in both.', 'H₂O₂ concentration was 3% in both experiments.'], strat: 'List what each experiment changed; the answer is changed in one and fixed in the other.' });
  S(5, { q: 'A student predicted that catalase works best near neutral pH. Do the results of Experiment 2 support this prediction?', c: ['Yes; the most O₂ was produced at pH 7.', 'Yes; the most O₂ was produced at pH 11.', 'No; the most O₂ was produced at pH 5.', 'No; O₂ production did not change with pH.'], a: 0, sub: 's.emi.hyp', cat: 'EMI', diff: 2, t: 45, e: 'Table 1 peaks at 27 mL at pH 7, which is neutral.', w: ['', 'pH 11 gave only 3 mL.', 'pH 5 gave 12 mL, less than pH 7.', 'Production varied from 2 to 27 mL.'], strat: 'Find the condition with the best result and compare it to the prediction.' });
  S(6, { q: 'Which explanation is most consistent with the decrease in O₂ production above 40°C in Experiment 1?', c: ['The H₂O₂ evaporated before mixing.', 'High temperatures changed the enzyme’s shape so it worked less well.', 'More oxygen dissolved in the water at high temperatures.', 'The pH of the solution rose above 11.'], a: 1, sub: 's.emi.hyp', cat: 'EMI', diff: 4, t: 60, e: 'Enzymes lose their working shape (denature) at high temperatures, which lowers activity. The passage held pH at 7, ruling out D.', w: ['Nothing in the procedure suggests evaporation.', '', 'Gas is less soluble in warmer water, so this would not reduce measured O₂.', 'pH was held at 7 in Experiment 1.'], strat: 'Rule out explanations that contradict the stated procedure first.' });
})(window.ACED_DATA);
