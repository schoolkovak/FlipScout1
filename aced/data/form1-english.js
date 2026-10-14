// Aced Practice Test 1 — English (50 questions, 6 passages; Passage III is the unscored field-test block).
window.ACED_DATA = window.ACED_DATA || {};
(function (D) {
  D.units = D.units || {}; D.items = D.items || [];
  const GA = 'Which choice makes the sentence most grammatically acceptable?';
  const RED = 'Which choice is least redundant in context?';
  const TR = 'Which choice provides the most logical transition?';
  const NA = 'Which of the following alternatives to the underlined portion would NOT be acceptable?';
  const PTS = ['Point A', 'Point B', 'Point C', 'Point D'];
  let n = 0;
  const unit = (id, u, items) => {
    D.units[id] = Object.assign({ id, sec: 'english' }, u);
    items.forEach(it => { n++; D.items.push(Object.assign({ id: `F1-E${n}`, sec: 'english', unit: id, n, held: true, form: 'F1', t: 35 }, it)); });
  };
  const NC = 'No Change';

  unit('F1E1', { label: 'Passage I', title: 'Keeping Time', passage: `[1]

When Walter Okoye retired from his job as an aerospace engineer, he assumed he would spend his mornings fishing. Instead, he spends {1|them} on a ladder inside the clock tower of the old county courthouse, {2|where, a four-faced clock} built in 1891 had stopped running decades earlier.

[2]

Okoye first noticed the clock on a walk with his granddaughter. All four faces showed 4:17, {3|and they had shown that time, for as long as anyone in town could remember}. Curious, he asked the county for permission to look inside. [A] What he found was a mechanism coated in feathers and rust, {4|its} pendulum frozen in place. [B]

[3]

{5|The courthouse has a large lawn.} Because replacement parts no longer existed, Okoye machined many of them himself in his garage. He {6|looked at} old repair manuals, corresponded with clock collectors in three countries, and {7|he taught himself} to cut brass gears by hand. [C]

[4]

Last October, the clock struck noon for the first time since 1962. A small crowd had gathered on the courthouse lawn, {8|but} when the bell rang, several people cheered. [D] Okoye, watching from the tower window, simply checked his wristwatch. The clock was {9|exactly precisely} on time.

[5]

Now Okoye climbs the tower every Sunday to wind the mechanism. He has begun training two high school students to take over the job someday. “A clock like this,” he says, “needs someone who cares about it more than it needs new parts.”` }, [
    { u: 1, q: GA, c: [NC, 'it', 'those', 'him'], a: 0, sub: 'e.usage.agree', cat: 'CSE', diff: 2, e: '“Them” correctly refers to the plural “mornings.”', strat: 'Find the noun the pronoun replaces and match number.' },
    { u: 2, q: GA, c: [NC, 'where a four-faced clock', 'where a four-faced, clock', 'where—a four-faced clock'], a: 1, sub: 'e.punct.comma', cat: 'CSE', diff: 2, e: 'No punctuation belongs between “where” and the subject of its clause.' },
    { u: 3, q: GA, c: [NC, 'and, they had shown that time for as long as anyone in town could remember', 'and they had shown, that time for as long as anyone in town could remember', 'and they had shown that time for as long as anyone in town could remember'], a: 3, sub: 'e.punct.comma', cat: 'CSE', diff: 3, e: 'The phrase “for as long as anyone ... could remember” is essential to the clause and takes no comma.' },
    { u: 4, q: GA, c: [NC, 'it’s', 'their', 'its’'], a: 0, sub: 'e.punct.other', cat: 'CSE', diff: 2, e: '“Its” is the possessive (the mechanism’s pendulum). “It’s” means “it is.”', strat: 'Expand “it’s” to “it is”; if that does not fit, use “its.”' },
    { u: 5, q: 'Which choice most effectively introduces the paragraph?', c: [NC, 'The courthouse was built in 1891.', 'Repairing the clock took nearly two years.', 'Pigeons often nest in towers.'], a: 2, sub: 'e.pow.addel', cat: 'POW', diff: 3, e: 'The paragraph describes the repair work, so a sentence about the repair introduces it.', strat: 'Read the rest of the paragraph first; the topic sentence names what it is about.' },
    { u: 6, q: 'Which choice most clearly conveys that Okoye examined the manuals closely?', c: [NC, 'saw', 'glanced at', 'pored over'], a: 3, sub: 'e.kla.word', cat: 'KLA', diff: 2, e: '“Pored over” means studied carefully; the others suggest little attention.' },
    { u: 7, q: GA, c: [NC, 'and teaching himself', 'and taught himself', 'and he was teaching himself'], a: 2, sub: 'e.usage.agree', cat: 'CSE', diff: 2, e: 'The series “looked ..., corresponded ..., and taught ...” needs parallel past-tense verbs without repeating the subject.' },
    { u: 8, q: TR, c: [NC, 'and', 'so', 'yet'], a: 1, sub: 'e.pow.transition', cat: 'POW', diff: 3, e: 'Nothing contrasts: people gathered, and then they cheered. “And” simply joins the events.', strat: 'Name the relationship (addition, contrast, cause) before choosing.' },
    { u: 9, q: RED, c: [NC, 'exactly and precisely', 'precisely exact', 'exactly'], a: 3, sub: 'e.kla.concise', cat: 'KLA', diff: 1, e: '“Exactly” and “precisely” mean the same thing; one is enough.' },
    { q: 'The writer wants to add this sentence: “Several of the original wooden gear teeth crumbled when he touched them.” The sentence would most logically be placed at:', c: PTS, a: 1, sub: 'e.pow.org', cat: 'POW', diff: 4, t: 50, e: 'It adds to the description of the damaged mechanism, so it belongs right after that description (Point B).' }
  ]);

  unit('F1E2', { label: 'Passage II', title: 'Roads Made of Ice', passage: `Each winter in northern Canada, a network of roads appears where none existed in summer. These ice roads, built across frozen lakes and rivers, {11|connects} remote communities to highways for a few months each year. Trucks use them to deliver fuel, building supplies, and groceries {12|that would otherwise, have to arrive} by plane at far greater cost.

Building an ice road is careful work. Crews drill test holes to measure the ice, which must be {13|at least} a meter thick before heavy trucks are allowed on it. Drivers keep their speed low; a fast-moving truck can push a wave through the water under the ice, {14|cracking the surface ahead of it}.

{15|Warmer winters have shortened the ice-road season in recent decades, and some communities are now asking for permanent all-weather roads.}` }, [
    { u: 11, q: GA, c: [NC, 'connect', 'has connected', 'is connecting'], a: 1, sub: 'e.usage.agree', cat: 'CSE', diff: 2, e: 'The subject is “roads” (plural); skip the phrase between commas.' },
    { u: 12, q: GA, c: [NC, 'that would otherwise have to arrive', 'that, would otherwise have to arrive', 'that would otherwise have to, arrive'], a: 1, sub: 'e.punct.comma', cat: 'CSE', diff: 2, e: 'Nothing in this essential clause should be set off by commas.' },
    { u: 13, q: NA, c: ['no less than', 'a minimum of', 'no fewer than', 'at most'], a: 3, sub: 'e.kla.word', cat: 'KLA', diff: 2, e: '“At most” reverses the meaning; the ice must be a meter or more.' },
    { u: 14, q: 'Which choice most clearly explains why drivers keep their speed low?', c: [NC, 'which is a common sight', 'creating a pleasant sound', 'as boats do in summer'], a: 0, sub: 'e.pow.addel', cat: 'POW', diff: 2, e: 'Only the original states the danger that slow driving prevents.' },
    { u: 15, q: 'The writer is considering deleting the underlined sentence. Should it be kept or deleted?', c: ['Kept, because it shows how a changing climate is affecting the roads the essay describes.', 'Kept, because it explains how test holes are drilled.', 'Deleted, because it contradicts the claim that ice roads are built each winter.', 'Deleted, because it introduces information about summer travel.'], a: 0, sub: 'e.pow.purpose', cat: 'POW', diff: 3, t: 45, e: 'The sentence extends the essay’s subject to how the roads are changing; it does not contradict anything.' }
  ]);

  unit('F1E3', { label: 'Passage III', title: 'Keep the Branch Libraries Open', passage: `[1]

When budgets tighten, city councils often look first at small branch libraries. {16|Its} hours are cut, staff are reassigned, and eventually the doors close. The savings look tidy on a spreadsheet. The losses are harder to measure, {17|but they’re} real.

[2]

A branch library is often the only free, heated, quiet indoor space within walking distance for {18|families who live nearby}. [A] Students come after school to use computers they {19|doesn’t have} at home. Job seekers print résumés. Older residents come for the newspaper and stay for conversation.

[3]

{20|Supporters of closures argue that most information is now available online.} That is true, but it ignores who lacks reliable internet access. According to one national survey, roughly one in five adults does not have broadband at home. {21|For example,} a library card is often the only way to get online at all.

[4]

Closing a branch also shifts costs rather than eliminating them. When a library closes, the after-school students do not disappear; {22|they go somewhere, else.} Some end up in fast-food restaurants, others at home alone. [B]

[5]

Cities should treat branch libraries the way they treat parks: as basic public infrastructure. {23|Nobody would suggest closing a park because fewer people visit it in winter.} [C] The same reasoning should protect the {24|libraries, that} anchor so many neighborhoods. [D]` }, [
    { u: 16, q: GA, c: [NC, 'Their', 'There', 'It’s'], a: 1, sub: 'e.usage.agree', cat: 'CSE', diff: 2, e: 'The pronoun refers to the plural “libraries.”' },
    { u: 17, q: GA, c: [NC, 'but there', 'but their', 'but they is'], a: 0, sub: 'e.punct.other', cat: 'CSE', diff: 2, e: '“They’re” = “they are,” which the sentence needs.' },
    { u: 18, q: RED, c: [NC, 'families who reside close by', 'families', 'families living in the area nearby'], a: 2, sub: 'e.kla.concise', cat: 'KLA', diff: 2, e: '“Within walking distance” already says the families are nearby.' },
    { u: 19, q: GA, c: [NC, 'don’t have', 'hasn’t', 'doesn’t had'], a: 1, sub: 'e.usage.agree', cat: 'CSE', diff: 1, e: 'The subject “they” takes “don’t.”' },
    { u: 20, q: 'Which choice most effectively introduces the counterargument that the paragraph responds to?', c: [NC, 'Many libraries host book clubs.', 'Broadband prices have changed over time.', 'Students often use library computers.'], a: 0, sub: 'e.pow.addel', cat: 'POW', diff: 3, e: 'The next sentence says “That is true, but...,” so this sentence must state the opposing view.' },
    { u: 21, q: TR, c: [NC, 'However,', 'For many of those adults,', 'In contrast,'], a: 2, sub: 'e.pow.transition', cat: 'POW', diff: 3, e: 'The sentence applies the statistic to the people without broadband; it is not an example or a contrast.' },
    { u: 22, q: GA, c: [NC, 'they go somewhere else.', 'they go, somewhere else.', 'they, go somewhere else.'], a: 1, sub: 'e.punct.comma', cat: 'CSE', diff: 1, e: '“Somewhere else” is one phrase and takes no comma.' },
    { u: 23, q: 'The writer is considering deleting the underlined sentence. Should it be kept or deleted?', c: ['Kept, because it gives a comparison that supports the paragraph’s claim about public infrastructure.', 'Kept, because it shows that parks are more popular than libraries.', 'Deleted, because it shifts the focus away from libraries.', 'Deleted, because it repeats the claim made in Paragraph 4.'], a: 0, sub: 'e.pow.addel', cat: 'POW', diff: 3, t: 45, e: 'The park comparison is the reasoning the next sentence applies to libraries.' },
    { u: 24, q: GA, c: [NC, 'libraries that', 'libraries; that', 'libraries: that'], a: 1, sub: 'e.punct.comma', cat: 'CSE', diff: 3, e: '“That anchor so many neighborhoods” is an essential clause; “that” clauses never take a comma before them.' },
    { q: 'The writer wants to add this sentence: “Others wander the streets until a parent gets home from work.” The sentence would most logically be placed at:', c: PTS, a: 1, sub: 'e.pow.org', cat: 'POW', diff: 3, t: 45, e: '“Others” continues the list of where students end up, which ends at Point B.' }
  ]);

  unit('F1E4', { label: 'Passage IV', title: 'The Kindergarten Experiment', passage: `[1]

In 1873, kindergarten was a {26|novel} idea in the United States. That year, Susan Blow, a young woman from a prominent St. Louis family, {27|persuaded and convinced} the city’s school superintendent to let her open a kindergarten inside a public school.

[2]

Blow had studied the ideas of Friedrich Froebel, a German educator who believed that young children learn best through play. {28|Froebel’s classrooms used songs, games, and simple wooden blocks to teach shape and number.} Blow adapted these methods for her own {29|classroom which opened} with forty-two students.

[3]

The experiment was a success. Within a decade, St. Louis {30|had been operating} more than fifty public kindergartens. Teachers from across the country came to observe Blow’s classroom, and {31|many of them, returned} home to start programs of their own.

[4]

Not everyone approved. Some taxpayers objected to spending public money on children too young to read. {32|Others, however, worried} that play had no place in school. Blow answered her critics with books and lectures that explained the purpose behind each activity.

[5]

{33|Today, kindergarten is part of nearly every public school system in the country.} Few of the children who stack blocks and sing counting songs each morning {34|realizes} that their classroom traces back to a single room in St. Louis.` }, [
    { u: 26, q: 'Which choice best conveys that kindergarten was unfamiliar to most Americans at the time?', c: [NC, 'popular', 'standard', 'tired'], a: 0, sub: 'e.kla.word', cat: 'KLA', diff: 2, e: '“Novel” means new and unfamiliar.' },
    { u: 27, q: RED, c: [NC, 'persuaded', 'persuaded, convinced,', 'convinced and persuaded'], a: 1, sub: 'e.kla.concise', cat: 'KLA', diff: 1, e: 'The two verbs mean the same thing.' },
    { u: 28, q: 'If the writer deleted this sentence, the paragraph would primarily lose:', c: ['a description of Froebel’s early life.', 'an explanation of why some taxpayers objected.', 'specific examples of the methods that Blow adapted.', 'evidence that kindergartens spread quickly.'], a: 2, sub: 'e.pow.addel', cat: 'POW', diff: 3, t: 45, e: 'The next sentence refers to “these methods,” which this sentence names.' },
    { u: 29, q: GA, c: [NC, 'classroom, which opened', 'classroom; which opened', 'classroom which, opened'], a: 1, sub: 'e.punct.comma', cat: 'CSE', diff: 3, e: 'A nonessential “which” clause is set off by a comma.' },
    { u: 30, q: GA, c: [NC, 'operates', 'has operated', 'operated'], a: 3, sub: 'e.usage.agree', cat: 'CSE', diff: 3, e: 'A completed past fact (“Within a decade”) takes the simple past.' },
    { u: 31, q: GA, c: [NC, 'many, of them returned', 'many of them returned', 'many of them returned,'], a: 2, sub: 'e.punct.comma', cat: 'CSE', diff: 2, e: 'No comma between the subject “many of them” and the verb “returned.”' },
    { u: 32, q: TR, c: [NC, 'Others, therefore, worried', 'Others worried', 'Others, for instance, worried'], a: 2, sub: 'e.pow.transition', cat: 'POW', diff: 3, e: 'The sentence adds a second objection; it does not contrast with, result from, or illustrate the first.' },
    { u: 33, q: 'Which choice most effectively connects the conclusion to the essay’s opening?', c: [NC, 'Froebel died in 1852.', 'Some critics continued to object.', 'St. Louis is a large city.'], a: 0, sub: 'e.pow.purpose', cat: 'POW', diff: 3, e: 'The essay opened with kindergarten as a novel idea; ending with how common it is now completes that arc.' },
    { u: 34, q: GA, c: [NC, 'realize', 'is realizing', 'has realized'], a: 1, sub: 'e.usage.agree', cat: 'CSE', diff: 2, e: 'The subject “Few” (of the children) is plural.' },
    { q: 'Suppose the writer’s goal had been to describe how one educator helped bring a new kind of schooling to American public schools. Would this essay accomplish that goal?', c: ['Yes, because it traces Blow’s first public kindergarten and the spread of the idea.', 'Yes, because it compares Froebel’s methods with those of other educators.', 'No, because it focuses mainly on critics of kindergarten.', 'No, because it describes only a single classroom.'], a: 0, sub: 'e.pow.purpose', cat: 'POW', diff: 3, t: 50, e: 'The essay follows Blow’s classroom from its opening to its national influence.' }
  ]);

  unit('F1E5', { label: 'Passage V', title: 'Pollinators of the Night', passage: `Most people picture bees when they think of pollination, but in the deserts of the American Southwest, much of the work happens after dark. Hawk moths, {36|whose} wings can beat more than seventy times a second, hover in front of pale flowers that open only at night. [A] The flowers’ {37|strong, sweet scent that smells sweet} helps the moths find them in the dark.

One such plant, the sacred datura, {38|produce} trumpet-shaped blossoms nearly eight inches long. [B] Each flower lasts a single night. By the next afternoon, it has withered. [C]

Researchers have found that artificial lighting near towns can confuse night pollinators. {39|Consequently,} plants near brightly lit roads may produce fewer seeds. [D]` }, [
    { u: 36, q: GA, c: [NC, 'who’s', 'which', 'whom'], a: 0, sub: 'e.punct.other', cat: 'CSE', diff: 2, e: '“Whose” shows possession (the moths’ wings).' },
    { u: 37, q: RED, c: [NC, 'strong, sweet scent', 'strong scent that smells sweetly', 'sweet-smelling scent, strong and sweet,'], a: 1, sub: 'e.kla.concise', cat: 'KLA', diff: 2, e: '“That smells sweet” repeats “sweet.”' },
    { u: 38, q: GA, c: [NC, 'produces', 'producing', 'have produced'], a: 1, sub: 'e.usage.agree', cat: 'CSE', diff: 2, e: 'The subject “plant” is singular.' },
    { u: 39, q: NA, c: ['As a result,', 'Therefore,', 'For this reason,', 'Nevertheless,'], a: 3, sub: 'e.pow.transition', cat: 'POW', diff: 2, e: 'The sentence states a consequence; “Nevertheless” signals contrast.' },
    { q: 'The writer wants to add this sentence: “Their great size gives a hovering moth plenty of room to feed.” The sentence would most logically be placed at:', c: PTS, a: 1, sub: 'e.pow.org', cat: 'POW', diff: 3, t: 45, e: '“Their great size” refers to the eight-inch blossoms, described just before Point B.' }
  ]);

  unit('F1E6', { label: 'Passage VI', title: 'Learning to Sail', passage: `[1]

I was forty-one the first time I stepped onto a sailboat, and I {41|was terrified, I} had never even learned to swim well. My daughter had signed us both up for a beginners’ class at the lake, and I could not think of a way to back out {42|that wouldn’t disappoint her}.

[2]

Our instructor, a retired ferry captain named Lorraine, wasted no time. Within the first hour, she {43|has taught us} how to rig the sail, how to steer with the tiller, and how to {44|duck, when} the boom swung across the deck. “The wind will tell you what to do,” she said. “Your job is to listen.”

[3]

For the first few weeks, I listened poorly. I pulled the sail in too tight, steered too hard, and {45|capsized twice}. Each time, my daughter laughed so hard that she nearly fell in after me. {46|Therefore,} Lorraine never raised her voice.

[4]

Then, one evening in July, something changed. The wind shifted, and instead of panicking, I eased the sail out and let the boat settle. {47|For a few minutes, we glided across the water in near silence, the only sound the waves against the hull.} My daughter looked back at me and grinned.

[5]

I am still not a strong swimmer. But I now own a small used sailboat, and on summer weekends my daughter and I take it out {48|together, the two of us,} as often as we can. {49|I have learned that being a beginner at forty-one is not so different from being a beginner at nine.}` }, [
    { u: 41, q: GA, c: [NC, 'was terrified; I', 'was terrified I', 'was terrified, and, I'], a: 1, sub: 'e.sent.boundary', cat: 'CSE', diff: 3, e: 'Two complete sentences joined by only a comma form a comma splice; a semicolon fixes it.', strat: 'Check both sides of the comma: if each could stand alone, a comma by itself is wrong.' },
    { u: 42, q: GA, c: [NC, 'that wouldn’t of disappointed her', 'that she wouldn’t be disappointing', 'that it wouldn’t disappoint them'], a: 0, sub: 'e.usage.agree', cat: 'CSE', diff: 2, e: 'The original is correct; “her” refers to the daughter.' },
    { u: 43, q: GA, c: [NC, 'teaches us', 'had taught us', 'will teach us'], a: 2, sub: 'e.usage.agree', cat: 'CSE', diff: 3, e: 'The narration is in the past; an action completed before another past moment takes “had taught.”' },
    { u: 44, q: GA, c: [NC, 'duck when', 'duck; when', 'duck, when,'], a: 1, sub: 'e.punct.comma', cat: 'CSE', diff: 2, e: 'The “when” clause is essential to “how to duck” and takes no comma.' },
    { u: 45, q: 'Which choice provides the most specific detail about the narrator’s mistakes?', c: [NC, 'did some other things wrong', 'had trouble', 'made errors'], a: 0, sub: 'e.kla.word', cat: 'KLA', diff: 1, e: '“Capsized twice” is concrete; the others are vague.' },
    { u: 46, q: TR, c: [NC, 'Through it all,', 'For example,', 'Similarly,'], a: 1, sub: 'e.pow.transition', cat: 'POW', diff: 3, e: 'Lorraine stayed calm during all of these mistakes; her calm is not a result of them.' },
    { u: 47, q: 'If the writer deleted this sentence, the paragraph would primarily lose:', c: ['an explanation of how to rig a sail.', 'a detail about the instructor’s past.', 'a description that shows the calm the narrator achieved by working with the wind.', 'evidence that the narrator capsized.'], a: 2, sub: 'e.pow.addel', cat: 'POW', diff: 3, t: 45, e: 'The sentence shows the result of the narrator finally “listening” to the wind.' },
    { u: 48, q: RED, c: [NC, 'together', 'together as a pair, the two of us,', 'jointly together'], a: 1, sub: 'e.kla.concise', cat: 'KLA', diff: 1, e: '“My daughter and I ... together” already means the two of us.' },
    { u: 49, q: 'Which choice best ends the essay by echoing Lorraine’s advice?', c: [NC, 'I have learned to listen to the wind.', 'Sailboats can be expensive to maintain.', 'My daughter now prefers kayaking.'], a: 1, sub: 'e.pow.purpose', cat: 'POW', diff: 3, e: 'Lorraine told them their job was to listen to the wind; this ending echoes it.' },
    { q: 'Suppose the writer’s goal had been to describe how taking on a personal challenge changed the writer. Would this essay accomplish that goal?', c: ['Yes, because it shows the narrator moving from fear to confidence through learning to sail.', 'Yes, because it describes the history of sailing on the lake.', 'No, because it focuses mainly on the instructor’s career.', 'No, because the narrator never sails again after the class.'], a: 0, sub: 'e.pow.purpose', cat: 'POW', diff: 3, t: 50, e: 'The essay traces the narrator’s change from terror to owning a boat.' }
  ]);
})(window.ACED_DATA);
