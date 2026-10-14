// Original Aced English passages (enhanced-ACT format: every item has a stem, 4 choices, "No Change" as A).
window.ACED_DATA = window.ACED_DATA || {};
(function (D) {
  D.units = D.units || {}; D.items = D.items || [];
  const unit = (id, u, items) => {
    D.units[id] = Object.assign({ id, sec: 'english' }, u);
    items.forEach((it, i) => D.items.push(Object.assign({ id: `${id}-${i + 1}`, sec: 'english', unit: id, n: i + 1 }, it)));
  };
  const GA = 'Which choice makes the sentence most grammatically acceptable?';

  unit('E1', { title: 'The Night Shift at KWLR', passage: `[1]

Every weeknight at eleven, the lights in the cinder-block building behind Harlan’s Hardware flicker on, and {1|Delia Moreno a retired schoolteacher, settles} into a swivel chair older than most of her listeners. For the next four hours she runs KWLR, a {2|low-power, community radio station} that reaches roughly three thousand homes in the valley.

[2]

The station went on the air in 1987, {3|when a group of volunteers, pooled their savings} to buy a used transmitter. [A] It has not missed a night since, not during the flood of 1996 and not during the ice storm that cut power to the county for nine days. During that storm, {4|Moreno and her colleague’s} ran the transmitter on a borrowed generator and read emergency notices between songs.

[3]

Moreno’s program is an unusual mix. [B] She might follow a country ballad with a recording of the high school jazz band, {5|than} spend ten minutes reading the week’s lost-and-found notices. [C] Listeners call in with requests, and {6|she plays nearly every one}. [D]

[4]

{7|Some people wonder whether a station like KWLR still matters when anyone can stream music on a phone.} Moreno thinks the answer is obvious. “A streaming service doesn’t know the bridge on Route 9 is closed,” she says. “We do.” {8|Consequently,} the station’s value lies less in the music it plays than in the neighbors it {9|connects together}.` }, [
    { u: 1, q: GA, c: ['No Change', 'Delia Moreno, a retired schoolteacher, settles', 'Delia Moreno, a retired schoolteacher settles', 'Delia Moreno a retired schoolteacher settles'], a: 1, sub: 'e.punct.comma', cat: 'CSE', diff: 2, t: 25,
      e: '“A retired schoolteacher” renames Delia Moreno and can be removed, so it needs a comma on both sides.', w: ['Only one comma: a nonessential phrase needs a pair.', '', 'The closing comma is missing, so the phrase is not fully set off.', 'With no commas, the appositive runs straight into the name and the verb.'], strat: 'Cover the phrase. “Delia Moreno settles into a swivel chair” still works, so the phrase gets two commas.' },
    { u: 2, q: GA, c: ['No Change', 'low-power community radio station', 'low-power, community, radio station', 'low, power community radio station'], a: 1, sub: 'e.punct.comma', cat: 'CSE', diff: 3, t: 30,
      e: '“Low-power” describes the whole unit “community radio station,” so no comma separates the adjectives.', w: ['A comma between adjectives works only when they could be joined by “and” (“low-power and community” does not work).', '', 'Commas break up the single term “community radio station.”', 'The comma splits the hyphenated adjective “low-power.”'], strat: 'Test with “and”: if “X and Y station” sounds wrong, use no comma.' },
    { u: 3, q: GA, c: ['No Change', 'when a group, of volunteers pooled their savings', 'when a group of volunteers pooled their savings', 'when, a group of volunteers pooled their savings'], a: 2, sub: 'e.punct.comma', cat: 'CSE', diff: 2, t: 25,
      e: 'No punctuation belongs between the subject “a group of volunteers” and its verb “pooled.”', w: ['The comma separates the subject from its verb.', 'The comma splits “a group of volunteers,” a single noun phrase.', '', 'The comma after “when” interrupts the clause for no reason.'], strat: 'Find the subject and verb; a single comma between them is always wrong.' },
    { u: 4, q: GA, c: ['No Change', 'Moreno and her colleagues', 'Moreno, and her colleagues,', 'Moreno and her colleagues’'], a: 1, sub: 'e.punct.other', cat: 'CSE', diff: 2, t: 25,
      e: '“Colleagues” is a plain plural subject here; nothing is being possessed, so no apostrophe.', w: ['The apostrophe makes “colleague” possessive, but the colleagues do not own anything in this sentence.', '', 'Commas around “and her colleagues” cut part of the compound subject away from the verb.', 'A plural possessive apostrophe is still a possessive.'], strat: 'Ask “colleagues’ what?” If nothing follows that they own, drop the apostrophe.' },
    { u: 5, q: GA, c: ['No Change', 'and than', 'that', 'then'], a: 3, sub: 'e.usage.agree', cat: 'CSE', diff: 2, t: 20,
      e: '“Then” shows sequence: first the ballad and the band, then the notices. “Than” is only for comparisons.', w: ['“Than” compares; nothing is being compared here.', '“And than” keeps the comparison word.', '“That” turns the rest into an unattached clause.', ''], strat: 'Than = comparison, then = time. Ask which one the sentence needs.' },
    { u: 6, q: 'Which choice most clearly emphasizes how responsive the station is to its listeners?', c: ['No Change', 'the phone sometimes rings', 'calls come from several towns', 'most requests are for older songs'], a: 0, sub: 'e.pow.addel', cat: 'POW', diff: 2, t: 30,
      e: 'Playing nearly every request shows the station responding to its audience, which is the point the question names.', w: ['', 'The phone ringing says nothing about the station’s response.', 'Where calls come from describes reach, not responsiveness.', 'The age of the songs describes taste, not responsiveness.'], strat: 'Match the choice to the exact goal in the stem; ignore choices that are merely true.' },
    { u: 7, q: 'Which choice best sets up the question that the rest of this paragraph answers?', c: ['No Change', 'Streaming services offer millions of songs.', 'Moreno taught school for thirty years.', 'The valley has about three thousand homes.'], a: 0, sub: 'e.pow.addel', cat: 'POW', diff: 3, t: 35,
      e: 'The paragraph answers whether a local station still matters. Only the original sets up that question.', w: ['', 'This focuses on streaming services, not on whether KWLR matters.', 'Moreno’s teaching career is unrelated to the paragraph’s argument.', 'Repeats a detail from paragraph 1 and does not introduce the argument.'], strat: 'Read the rest of the paragraph first, then pick the sentence that sets up what follows.' },
    { u: 8, q: 'Which choice provides the most logical transition?', c: ['No Change', 'For her,', 'Nevertheless,', 'Similarly,'], a: 1, sub: 'e.pow.transition', cat: 'POW', diff: 3, t: 35,
      e: 'The sentence states Moreno’s own view of the station, so “For her” fits. Nothing here is a result, a contrast, or a parallel.', w: ['“Consequently” signals a result, but the sentence restates her opinion rather than concluding from the quote.', '', '“Nevertheless” signals contrast, but the sentence agrees with her quote.', '“Similarly” signals a parallel example that is not present.'], strat: 'Name the relationship between the two sentences in one word before reading the choices.' },
    { u: 9, q: 'Which choice is least redundant in context?', c: ['No Change', 'connects', 'connects and joins', 'brings together and connects'], a: 1, sub: 'e.kla.concise', cat: 'KLA', diff: 2, t: 20,
      e: '“Connects” already means bringing together, so any added word repeats the idea.', w: ['“Together” repeats the meaning of “connects.”', '', '“Joins” repeats “connects.”', 'Two verbs with the same meaning.'], strat: 'With a redundancy stem, the shortest grammatical choice is usually right.' },
    { q: 'The writer wants to add this sentence: “One night last spring, she devoted an entire hour to birthday announcements.” It would most logically be placed at:', c: ['Point A', 'Point B', 'Point C', 'Point D'], a: 2, sub: 'e.pow.org', cat: 'POW', diff: 4, t: 50,
      e: 'The sentence is another example of the program’s unusual mix, so it belongs right after the examples of ballads, band recordings, and notices (Point C).', w: ['Paragraph 2 is about the station’s history, not its programming.', 'Point B comes before any examples, so the birthday hour would appear before the paragraph shows what the mix is.', '', 'Point D follows the sentence about requests, which shifts the focus to listeners.'], strat: 'Find the sentence the new one most resembles and place it next to that sentence.' }
  ]);

  unit('E2', { title: 'Reading the Cliffs', passage: `In the early 1800s, the cliffs near the English town of Lyme Regis {1|was crumbling} into the sea after every winter storm. For most residents, the falling rock was a nuisance. For Mary Anning, a teenager from a poor family, it was an opportunity.

Anning and her brother searched the rubble for fossils to sell to tourists. In 1811, her brother spotted a strange skull. Over the following months, Anning {2|located the rest of the skeleton}, a marine reptile later named *Ichthyosaurus*. Over the next three decades she found the first complete plesiosaur skeleton and one of the earliest pterosaurs discovered in Britain.

Wealthy collectors bought her fossils, and the scientists who described them in journals {3|often omitted, her name entirely}. As a woman and a member of the working class, she {4|could not of joined} the Geological Society of London. Today, historians count her among the founders of paleontology.` }, [
    { u: 1, q: GA, c: ['No Change', 'were crumbling', 'crumbles', 'has crumbled'], a: 1, sub: 'e.usage.agree', cat: 'CSE', diff: 2, t: 25,
      e: 'The subject is the plural “cliffs,” and the passage is in the past tense, so “were crumbling.”', w: ['“Was” is singular, but the subject “cliffs” is plural.', '', 'Present tense clashes with “In the early 1800s.”', '“Has” is singular and present perfect.'], strat: 'Skip the phrase “near the English town of Lyme Regis” and read “the cliffs ___ crumbling.”' },
    { u: 2, q: 'Which choice most effectively emphasizes the difficulty of Anning’s work?', c: ['No Change', 'painstakingly chiseled the rest of the skeleton out of the rock', 'looked for the rest of the skeleton', 'found more of the skeleton'], a: 1, sub: 'e.kla.word', cat: 'KLA', diff: 3, t: 30,
      e: '“Painstakingly chiseled ... out of the rock” shows slow, effortful work. The others just report that she found it.', w: ['“Located” says nothing about effort.', '', '“Looked for” does not even say she succeeded.', '“Found” is neutral and hides the effort.'], strat: 'When the stem names an effect (“emphasizes difficulty”), choose the most specific wording that creates it.' },
    { u: 3, q: GA, c: ['No Change', 'often, omitted her name entirely', 'often omitted her name, entirely', 'often omitted her name entirely'], a: 3, sub: 'e.punct.comma', cat: 'CSE', diff: 2, t: 25,
      e: 'The verb “omitted” and its object “her name” cannot be separated by a comma, and nothing here needs one.', w: ['The comma splits the verb from its object.', 'The comma separates the adverb from the verb.', 'The comma separates “entirely” from the phrase it modifies.', ''], strat: 'If no rule calls for a comma, choose the version with none.' },
    { u: 4, q: GA, c: ['No Change', 'couldn’t never join', 'could not have joined to', 'could not join'], a: 3, sub: 'e.usage.agree', cat: 'CSE', diff: 2, t: 20,
      e: '“Could not join” is the standard form. “Could of” is a misspelling of “could have.”', w: ['“Could of” is never correct.', 'Double negative.', '“Joined to” adds an unneeded preposition.', ''], strat: 'Say it aloud carefully: “could of” is a sound-alike error for “could have.”' },
    { q: 'Suppose the writer’s goal had been to explain how fossils form. Would this essay accomplish that goal?', c: ['Yes, because it describes the skeleton of a marine reptile.', 'Yes, because it explains how storms wear away cliffs.', 'No, because it focuses on Anning’s discoveries and the recognition she was denied.', 'No, because it focuses mainly on the history of the Geological Society.'], a: 2, sub: 'e.pow.purpose', cat: 'POW', diff: 3, t: 45,
      e: 'The essay is a profile of Anning; it never explains the process by which fossils form.', w: ['Mentioning a skeleton is not explaining fossil formation.', 'Storms are background, not an explanation of fossilization.', '', 'Right verdict, wrong reason: the Society is mentioned once.'], strat: 'Decide Yes/No from the main focus, then pick the reason that accurately describes the whole essay.' }
  ]);
})(window.ACED_DATA);
