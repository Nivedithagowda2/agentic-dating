export default function About() {
  return (
    <>
      <h1>How it works</h1>
      <div className="card" style={{ marginTop: 14 }}>
        <ol style={{ lineHeight: 1.8 }}>
          <li><b>Scrape.</b> Two public sources per person: LinkedIn profile and public Instagram profile (bio + recent posts), fetched through Apify actors.</li>
          <li><b>Profile.</b> A profiler agent (Claude) turns both into needs, hobbies, interests, values, personality, deal-breakers and conversation hooks, each backed by quoted evidence and a confidence note.</li>
          <li><b>Shortlist.</b> A matchmaker agent picks the best candidates for each person, so 25 people do not need 300 full dates.</li>
          <li><b>Date.</b> Each person's agent only knows its own profile. The two agents meet at a venue and talk turn by turn, learning about each other only through the conversation.</li>
          <li><b>Judge.</b> A judge reads both profiles and the transcript, then scores chemistry, values, interests and lifestyle, and a directional fit score for each person.</li>
          <li><b>Rank.</b> Each person&apos;s list is sorted by how good the other is <i>for them</i>; mutual scores surface the strongest pairs.</li>
        </ol>
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <h3>Privacy</h3>
        <p className="small muted">
          Use this only with people who consented, or public figures with deliberately public profiles. Sensitive traits (health, religion, politics, orientation, ethnicity) are never inferred. Anyone can be deleted, with all their dates, from their profile page.
        </p>
      </div>
    </>
  );
}
