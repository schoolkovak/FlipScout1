// Aced Practice Test 1 — Science (40 questions, 6 passages; Passage IV is the unscored field-test block).
window.ACED_DATA = window.ACED_DATA || {};
(function (D) {
  D.units = D.units || {}; D.items = D.items || [];
  let n = 0;
  const unit = (id, u, items) => {
    D.units[id] = Object.assign({ id, sec: 'science' }, u);
    items.forEach(it => { n++; D.items.push(Object.assign({ id: `F1-S${n}`, sec: 'science', unit: id, n, held: true, form: 'F1', t: 60 }, it)); });
  };

  unit('F1S1', { label: 'Passage I', passage: `In mountain watersheds, much of the water in streams comes from melting snow. Hydrologists measured the snowpack depth on April 1 each year and the discharge (volume of water flowing past a point per second) of a stream fed by that snowpack.

Figure 1 shows the monthly mean discharge in 2022 and 2023. Table 1 shows the April 1 snowpack depth and the peak monthly discharge for 5 years.

{fig:Figure 1}

{fig:Table 1}`, figures: [
    { id: 'Figure 1', type: 'line', x: { label: 'Month (1 = January)', min: 1, max: 12 }, y: { label: 'Mean discharge (m³/s)', min: 0, max: 45 }, series: [
      { name: '2022', points: [[1, 4], [2, 4], [3, 6], [4, 14], [5, 32], [6, 41], [7, 22], [8, 9], [9, 6], [10, 5], [11, 5], [12, 4]] },
      { name: '2023', points: [[1, 4], [2, 5], [3, 9], [4, 18], [5, 20], [6, 12], [7, 7], [8, 5], [9, 4], [10, 4], [11, 4], [12, 4]] }] },
    { id: 'Table 1', type: 'table', columns: ['Year', 'April 1 snowpack (cm)', 'Peak monthly discharge (m³/s)', 'Month of peak'], rows: [['2019', '180', '38', 'June'], ['2020', '120', '26', 'May'], ['2021', '95', '21', 'May'], ['2022', '190', '41', 'June'], ['2023', '85', '20', 'May']] }
  ] }, [
    { q: 'According to Figure 1, in which month of 2022 was mean discharge greatest?', c: ['April', 'May', 'June', 'July'], a: 2, sub: 's.iod.read', cat: 'IOD', diff: 1, e: 'The 2022 curve peaks at 41 m³/s in month 6, June.' },
    { q: 'According to Figure 1, how did April discharge in 2023 compare with April discharge in 2022?', c: ['It was 4 m³/s less.', 'It was the same.', 'It was 4 m³/s greater.', 'It was 14 m³/s greater.'], a: 2, sub: 's.iod.read', cat: 'IOD', diff: 2, e: 'April: 18 m³/s in 2023 vs 14 m³/s in 2022.' },
    { q: 'According to Table 1, as April 1 snowpack depth increased, peak monthly discharge:', c: ['rose steadily.', 'fell steadily.', 'rose, then fell.', 'showed no clear pattern.'], a: 0, sub: 's.iod.trend', cat: 'IOD', diff: 2, e: 'Ordering by snowpack (85, 95, 120, 180, 190), the peaks are 20, 21, 26, 38, 41.', strat: 'Re-sort the table rows by the variable named in the question.' },
    { q: 'Based on Table 1, a year with an April 1 snowpack of 150 cm would most likely have a peak monthly discharge:', c: ['less than 21 m³/s.', 'between 21 and 26 m³/s.', 'between 26 and 38 m³/s.', 'greater than 41 m³/s.'], a: 2, sub: 's.iod.trend', cat: 'IOD', diff: 2, e: '150 cm is between 120 cm (26) and 180 cm (38).' },
    { q: 'Which hypothesis is best supported by Table 1?', c: ['Deeper snowpack is associated with a later peak in discharge.', 'Deeper snowpack is associated with an earlier peak in discharge.', 'Snowpack depth has no relationship with discharge.', 'Discharge always peaks in May.'], a: 0, sub: 's.emi.hyp', cat: 'EMI', diff: 3, e: 'Years with 180–190 cm peaked in June; years with 85–120 cm peaked in May.' },
    { q: 'According to Figure 1, in which month was the difference in discharge between 2022 and 2023 greatest?', c: ['April', 'May', 'June', 'July'], a: 2, sub: 's.iod.read', cat: 'IOD', diff: 2, e: 'June: 41 − 12 = 29 m³/s, the largest gap.' }
  ]);

  unit('F1S2', { label: 'Passage II', passage: `Students studied how salt affects the germination (sprouting) of radish seeds. In each trial, 50 seeds were placed on paper in a covered dish and watered with a solution. The percent of seeds that germinated after 5 days was recorded.

**Experiment 1**

Seeds were watered with sodium chloride (NaCl) solutions of different concentrations, measured in millimoles per liter (mM). All dishes were kept at 22°C.

{fig:Table 1}

**Experiment 2**

Seeds were watered with 50 mM NaCl, and dishes were kept at different temperatures.

{fig:Table 2}

**Experiment 3**

Before planting, seeds were soaked in pure water for different lengths of time. They were then watered with 100 mM NaCl at 22°C.

{fig:Table 3}`, figures: [
    { id: 'Table 1', type: 'table', columns: ['NaCl (mM)', 'Germination (%)'], rows: [['0', '96'], ['25', '90'], ['50', '74'], ['100', '38'], ['150', '10']] },
    { id: 'Table 2', type: 'table', columns: ['Temperature (°C)', 'Germination (%)'], rows: [['12', '40'], ['17', '62'], ['22', '74'], ['27', '80'], ['32', '58']] },
    { id: 'Table 3', type: 'table', columns: ['Soaking time (hr)', 'Germination (%)'], rows: [['0', '38'], ['6', '46'], ['12', '60'], ['24', '61']] }
  ] }, [
    { q: 'In Experiment 1, as NaCl concentration increased, the percent of seeds that germinated:', c: ['rose steadily.', 'fell steadily.', 'rose, then fell.', 'did not change.'], a: 1, sub: 's.iod.trend', cat: 'IOD', diff: 1, e: '96 → 90 → 74 → 38 → 10.' },
    { q: 'In Experiment 2, the greatest percent germination occurred at:', c: ['17°C.', '22°C.', '27°C.', '32°C.'], a: 2, sub: 's.iod.read', cat: 'IOD', diff: 1, e: '80% at 27°C.' },
    { q: 'Which set of conditions was tested in both Experiment 1 and Experiment 2?', c: ['0 mM NaCl at 22°C', '50 mM NaCl at 22°C', '50 mM NaCl at 27°C', '100 mM NaCl at 22°C'], a: 1, sub: 's.sin.design', cat: 'SIN', diff: 3, e: 'Experiment 2 used 50 mM throughout, and Experiment 1 was run at 22°C; both give 74%.' },
    { q: 'What was the independent variable in Experiment 3?', c: ['NaCl concentration', 'Temperature', 'Soaking time', 'Percent germination'], a: 2, sub: 's.sin.design', cat: 'SIN', diff: 2, e: 'Soaking time was changed; germination was measured.' },
    { q: 'Based on Experiment 1, seeds watered with 75 mM NaCl at 22°C would most likely show a germination percent:', c: ['above 90%.', 'between 74% and 90%.', 'between 38% and 74%.', 'below 38%.'], a: 2, sub: 's.iod.trend', cat: 'IOD', diff: 2, e: '75 mM lies between 50 mM (74%) and 100 mM (38%).' },
    { q: 'A student claims that soaking seeds before planting increases germination in salty water, but that soaking longer than 12 hours adds little benefit. Do the results of Experiment 3 support this claim?', c: ['Yes; germination rose from 38% to 60% by 12 hours and was 61% at 24 hours.', 'Yes; germination was highest with no soaking.', 'No; germination decreased with soaking.', 'No; germination rose sharply between 12 and 24 hours.'], a: 0, sub: 's.emi.hyp', cat: 'EMI', diff: 3, e: 'Most of the gain happened by 12 hours; 24 hours added only 1 point.' },
    { q: 'Why were all dishes in Experiment 1 kept at the same temperature?', c: ['To make the seeds germinate faster', 'So that differences in germination could be attributed to NaCl concentration', 'Because temperature has no effect on germination', 'To reduce the number of seeds needed'], a: 1, sub: 's.sin.design', cat: 'SIN', diff: 2, e: 'Holding temperature constant isolates the effect of salt. Experiment 2 shows temperature does matter.' }
  ]);

  unit('F1S3', { label: 'Passage III', passage: `Between 1990 and 2020, a coastal salt marsh (Marsh X) lost about 18% of its area as grasses died and the ground became open water. Three scientists propose explanations.

**Scientist 1**

Marshes survive rising seas by trapping sediment and building up their surfaces. At Marsh X, sea level has risen about 4.1 mm per year since 1990, but the marsh surface has risen only about 2.6 mm per year. Because the surface cannot keep pace, low areas are flooded so often that the grasses die. Losses should be greatest in the lowest parts of the marsh.

**Scientist 2**

Sea-level rise alone would not cause the losses observed. Two dams built upstream in the 1980s trap most of the sediment the river once carried, and the sediment reaching Marsh X has dropped by about 60%. With less sediment, the marsh cannot build up its surface. Restoring sediment flow would allow the marsh to recover even if sea level continued to rise at its current rate.

**Scientist 3**

The pattern of loss points to grazing. Losses are concentrated along creek banks, where marsh crabs feed on grass roots. Fishing has reduced the fish and birds that eat these crabs, and crab densities on creek banks have tripled since 1990. In test plots where researchers fenced crabs out, grasses regrew within two growing seasons, even at low elevations.` }, [
    { q: 'Scientist 1’s explanation is based mainly on the claim that:', c: ['crabs are eating the grass roots.', 'the marsh surface is rising more slowly than sea level.', 'dams have increased sediment flow.', 'the marsh is growing in area.'], a: 1, sub: 's.emi.hyp', cat: 'EMI', diff: 2, e: '4.1 mm/yr sea-level rise vs 2.6 mm/yr surface rise.' },
    { q: 'Which scientist would most likely predict that removing the upstream dams would stop the marsh loss?', c: ['Scientist 1', 'Scientist 2', 'Scientist 3', 'No scientist'], a: 1, sub: 's.emi.hyp', cat: 'EMI', diff: 2, e: 'Scientist 2 says restoring sediment flow would let the marsh recover.' },
    { q: 'Scientists 1 and 2 would most likely agree that:', c: ['the marsh surface is not building up fast enough to keep pace with water levels.', 'crab grazing is the main cause of the loss.', 'sea level at Marsh X has not changed.', 'the dams have increased the sediment supply.'], a: 0, sub: 's.emi.hyp', cat: 'EMI', diff: 3, e: 'Both explanations depend on the surface failing to build up quickly enough.' },
    { q: 'Suppose a survey found that grass loss was greatest in the lowest parts of the marsh, whether or not those areas were near creek banks. This finding would most strongly support the explanation of:', c: ['Scientist 1 only.', 'Scientist 3 only.', 'Scientists 2 and 3 only.', 'Scientist 1 and Scientist 3.'], a: 0, sub: 's.emi.hyp', cat: 'EMI', diff: 3, e: 'Scientist 1 predicts losses in the lowest areas; Scientist 3 predicts losses along creek banks.' },
    { q: 'The fenced test plots described by Scientist 3 were most likely designed to test whether:', c: ['sea-level rise kills marsh grass.', 'crabs are responsible for the grass loss.', 'dams reduce sediment supply.', 'fish populations have declined.'], a: 1, sub: 's.sin.design', cat: 'SIN', diff: 2, e: 'Fencing removes one factor, the crabs, and compares the result with unfenced areas.' },
    { q: 'According to Scientist 2, by about what percent has sediment delivery to Marsh X decreased?', c: ['18%', '26%', '41%', '60%'], a: 3, sub: 's.iod.read', cat: 'IOD', diff: 1, e: 'Stated directly by Scientist 2.' },
    { q: 'Which finding, if true, would most weaken Scientist 3’s explanation?', c: ['Crab densities on creek banks have increased.', 'Grasses inside fenced plots died at the same rate as grasses outside them.', 'Sea level has risen 4.1 mm per year.', 'The dams were built in the 1980s.'], a: 1, sub: 's.emi.hyp', cat: 'EMI', diff: 3, e: 'If excluding crabs made no difference, crabs could not be the cause.' }
  ]);

  unit('F1S4', { label: 'Passage IV', passage: `A microbiologist grew a species of bacteria in liquid broth at three temperatures. The optical density (OD) of each culture, which increases as the number of cells increases, was measured every 2 hours (see Figure 1). The doubling time, the time needed for the number of cells to double during rapid growth, was also calculated at four temperatures (see Table 1).

{fig:Figure 1}

{fig:Table 1}`, figures: [
    { id: 'Figure 1', type: 'line', x: { label: 'Time (hr)', min: 0, max: 12 }, y: { label: 'Optical density', min: 0, max: 1.4 }, series: [
      { name: '25°C', points: [[0, 0.05], [2, 0.07], [4, 0.12], [6, 0.21], [8, 0.36], [10, 0.55], [12, 0.7]] },
      { name: '37°C', points: [[0, 0.05], [2, 0.12], [4, 0.3], [6, 0.68], [8, 1.05], [10, 1.2], [12, 1.22]] },
      { name: '42°C', points: [[0, 0.05], [2, 0.08], [4, 0.14], [6, 0.24], [8, 0.33], [10, 0.38], [12, 0.4]] }] },
    { id: 'Table 1', type: 'table', columns: ['Temperature (°C)', 'Doubling time (min)'], rows: [['25', '95'], ['30', '52'], ['37', '30'], ['42', '70']] }
  ] }, [
    { q: 'According to Figure 1, at 6 hours, which culture had the greatest optical density?', c: ['25°C', '37°C', '42°C', 'All were equal'], a: 1, sub: 's.iod.read', cat: 'IOD', diff: 1, e: '0.68 at 37°C.' },
    { q: 'According to Figure 1, between 10 and 12 hours, the optical density of the 37°C culture:', c: ['doubled.', 'decreased sharply.', 'changed very little.', 'increased faster than at any earlier time.'], a: 2, sub: 's.iod.trend', cat: 'IOD', diff: 2, e: '1.20 to 1.22: the curve has leveled off.' },
    { q: 'According to Table 1, as temperature increased from 25°C to 42°C, doubling time:', c: ['rose steadily.', 'fell steadily.', 'fell, then rose.', 'rose, then fell.'], a: 2, sub: 's.iod.trend', cat: 'IOD', diff: 2, e: '95 → 52 → 30, then up to 70.' },
    { q: 'Based on Table 1, the doubling time at 34°C would most likely be:', c: ['less than 30 min.', 'between 30 and 52 min.', 'between 52 and 70 min.', 'greater than 95 min.'], a: 1, sub: 's.iod.trend', cat: 'IOD', diff: 2, e: '34°C lies between 30°C (52 min) and 37°C (30 min).' },
    { q: 'Which statement is consistent with both Figure 1 and Table 1?', c: ['The temperature with the shortest doubling time also showed the fastest rise in optical density.', 'The culture at 42°C grew fastest.', 'Doubling time was the same at every temperature.', 'Optical density decreased over time at 25°C.'], a: 0, sub: 's.emi.hyp', cat: 'EMI', diff: 3, e: '37°C has the shortest doubling time (30 min) and the steepest curve.' },
    { q: 'Which variable was NOT changed by the microbiologist in the experiment shown in Figure 1?', c: ['Temperature', 'The species of bacteria', 'Time of measurement', 'The culture being measured'], a: 1, sub: 's.sin.design', cat: 'SIN', diff: 2, e: 'One species was used throughout.' }
  ]);

  unit('F1S5', { label: 'Passage V', passage: `Students tested how well different materials keep hot water from cooling. In each trial, an identical metal can was filled with 400 mL of water at 80°C, wrapped in a material, and left for 30 minutes. The final water temperature was then recorded.

**Experiment 1**

Each can was wrapped in a 1 cm layer of a different material (or no material). Room temperature was 20°C.

{fig:Table 1}

**Experiment 2**

Cans were wrapped in foam of different thicknesses. Room temperature was 20°C.

{fig:Table 2}

**Experiment 3**

Cans were wrapped in 1 cm of foam and placed in rooms at different temperatures.

{fig:Table 3}`, figures: [
    { id: 'Table 1', type: 'table', columns: ['Material', 'Final temperature (°C)'], rows: [['None', '48'], ['Cotton', '58'], ['Wool', '62'], ['Foam', '66'], ['Aluminum foil', '52']] },
    { id: 'Table 2', type: 'table', columns: ['Foam thickness (cm)', 'Final temperature (°C)'], rows: [['0.5', '61'], ['1', '66'], ['2', '70'], ['3', '71']] },
    { id: 'Table 3', type: 'table', columns: ['Room temperature (°C)', 'Final temperature (°C)'], rows: [['10', '58'], ['20', '66'], ['30', '72']] }
  ] }, [
    { q: 'In Experiment 1, which material kept the water warmest?', c: ['Cotton', 'Wool', 'Foam', 'Aluminum foil'], a: 2, sub: 's.iod.read', cat: 'IOD', diff: 1, e: 'Foam: 66°C.' },
    { q: 'In Experiment 1, the can with no material most likely served as:', c: ['a control for comparing the materials.', 'the best insulator.', 'a test of room temperature.', 'a way to measure water volume.'], a: 0, sub: 's.sin.design', cat: 'SIN', diff: 2, e: 'It shows how fast the water cools without any insulation.' },
    { q: 'According to Experiment 2, when foam thickness increased from 2 cm to 3 cm, the final temperature:', c: ['decreased by 1°C.', 'stayed the same.', 'increased by 1°C.', 'increased by 4°C.'], a: 2, sub: 's.iod.read', cat: 'IOD', diff: 1, e: '70°C to 71°C.' },
    { q: 'Which factor was held constant in Experiment 2 but varied in Experiment 3?', c: ['Foam thickness', 'Room temperature', 'Water volume', 'Starting water temperature'], a: 1, sub: 's.sin.design', cat: 'SIN', diff: 3, e: 'Experiment 2 was run at 20°C; Experiment 3 changed the room temperature.' },
    { q: 'Which trial appears in all three experiments?', c: ['Cotton, 1 cm, 20°C room', 'Foam, 0.5 cm, 20°C room', 'Foam, 1 cm, 20°C room', 'Foam, 1 cm, 30°C room'], a: 2, sub: 's.sin.design', cat: 'SIN', diff: 3, e: 'Each experiment includes 1 cm foam at 20°C, giving 66°C every time.' },
    { q: 'Based on Experiment 3, a can wrapped in 1 cm of foam in a 25°C room would most likely have a final temperature:', c: ['below 58°C.', 'between 58°C and 66°C.', 'between 66°C and 72°C.', 'above 72°C.'], a: 2, sub: 's.iod.trend', cat: 'IOD', diff: 2, e: '25°C is between 20°C (66) and 30°C (72).' },
    { q: 'A student concludes that wool insulates better than cotton because the wool layer was thicker. Is this conclusion consistent with the procedure?', c: ['Yes, because wool kept the water warmer.', 'Yes, because thicker foam kept water warmer in Experiment 2.', 'No, because cotton kept the water warmer.', 'No, because every material in Experiment 1 was the same thickness.'], a: 3, sub: 's.emi.hyp', cat: 'EMI', diff: 3, e: 'All layers were 1 cm, so thickness cannot explain the difference.' }
  ]);

  unit('F1S6', { label: 'Passage VI', passage: `Stomata are small pores on leaves that let carbon dioxide (CO₂) in and water vapor out. Scientists studied how CO₂ concentration relates to stomatal density (number of stomata per mm² of leaf).

**Study 1**

Bean plants of one variety were grown in chambers with identical light, water, and temperature but different CO₂ concentrations, in parts per million (ppm). Stomatal density and daily water loss per plant were measured (see Table 1).

{fig:Table 1}

**Study 2**

Scientists measured stomatal density in preserved leaves of the same species collected in 1900, 1950, and 2000, when atmospheric CO₂ was about 296, 311, and 370 ppm, respectively (see Figure 1).

{fig:Figure 1}`, figures: [
    { id: 'Table 1', type: 'table', columns: ['CO₂ (ppm)', 'Stomatal density (per mm²)', 'Water loss (g/day)'], rows: [['300', '180', '9.0'], ['400', '160', '8.1'], ['600', '130', '6.6'], ['800', '115', '5.9']] },
    { id: 'Figure 1', type: 'bar', x: { label: 'Year leaves were collected' }, y: { label: 'Stomatal density (per mm²)', min: 0, max: 200 }, series: [{ name: 'Density', points: [['1900', 186], ['1950', 178], ['2000', 151]] }] }
  ] }, [
    { q: 'In Study 1, as CO₂ concentration increased, stomatal density:', c: ['increased.', 'decreased.', 'stayed the same.', 'rose, then fell.'], a: 1, sub: 's.iod.trend', cat: 'IOD', diff: 1, e: '180 → 160 → 130 → 115.' },
    { q: 'According to Table 1, daily water loss at 600 ppm CO₂ was:', c: ['5.9 g', '6.6 g', '8.1 g', '9.0 g'], a: 1, sub: 's.iod.read', cat: 'IOD', diff: 1, e: 'Read across the 600 ppm row.' },
    { q: 'Based on Table 1, how is stomatal density related to water loss?', c: ['Plants with higher stomatal density lost more water.', 'Plants with higher stomatal density lost less water.', 'Water loss did not depend on stomatal density.', 'Water loss was greatest at 800 ppm.'], a: 0, sub: 's.emi.hyp', cat: 'EMI', diff: 2, e: 'Density and water loss fall together.' },
    { q: 'Are the results of Study 2 consistent with those of Study 1?', c: ['Yes; as atmospheric CO₂ rose over time, stomatal density decreased.', 'Yes; stomatal density increased over time.', 'No; stomatal density increased as CO₂ rose.', 'No; Study 2 shows no change in density.'], a: 0, sub: 's.emi.hyp', cat: 'EMI', diff: 3, e: 'CO₂ rose from 296 to 370 ppm while density fell from 186 to 151.' },
    { q: 'Based on Table 1, the stomatal density of bean plants grown at 700 ppm CO₂ would most likely be:', c: ['less than 115 per mm².', 'between 115 and 130 per mm².', 'between 130 and 160 per mm².', 'greater than 160 per mm².'], a: 1, sub: 's.iod.trend', cat: 'IOD', diff: 2, e: '700 ppm lies between 600 (130) and 800 (115).' },
    { q: 'In Study 1, why were light, water, and temperature kept identical in all chambers?', c: ['To increase water loss', 'So that differences could be attributed to CO₂ concentration', 'To make the plants grow faster', 'Because stomata do not respond to light'], a: 1, sub: 's.sin.design', cat: 'SIN', diff: 2, e: 'Holding other factors constant isolates the effect of CO₂.' },
    { q: 'A scientist predicts that leaves of this species collected when atmospheric CO₂ reaches 500 ppm will have a stomatal density below 151 per mm². Is this prediction consistent with the data?', c: ['Yes; density was 151 at 370 ppm and continued to fall at higher CO₂ in Study 1.', 'Yes; density increases as CO₂ increases.', 'No; density was highest in 2000.', 'No; Study 1 shows density does not change above 400 ppm.'], a: 0, sub: 's.emi.hyp', cat: 'EMI', diff: 4, e: 'Both studies show density dropping as CO₂ rises, so a value below 151 at 500 ppm fits the trend.' }
  ]);
})(window.ACED_DATA);
