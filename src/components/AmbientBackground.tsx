export function AmbientBackground() {
  return (
    <div className="ambient-field" aria-hidden="true">
      <div className="ambient-ascii ambient-ascii-left">{`0101 1001\n0x 7F 2A\nNODE::OK\n1010 0011`}</div>
      <div className="ambient-ascii ambient-ascii-right">{`LINK 04\n10 11 01\nAUTH::LOCAL\n0x C3 8D`}</div>
      <svg className="ambient-network" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
        <path d="M56 612 229 487 421 552 596 397 775 462 976 276 1157 332" />
        <path d="M229 487 286 277 485 201 596 397 709 188 976 276 1007 548" />
        <path d="M421 552 488 697 775 462 860 671 1007 548 1157 332" />
        <circle cx="229" cy="487" r="3" /><circle cx="421" cy="552" r="3" />
        <circle cx="596" cy="397" r="4" /><circle cx="775" cy="462" r="3" />
        <circle cx="976" cy="276" r="4" /><circle cx="709" cy="188" r="3" />
        <circle cx="1007" cy="548" r="3" /><circle cx="286" cy="277" r="3" />
      </svg>
      <span className="ambient-particle particle-one" />
      <span className="ambient-particle particle-two" />
      <span className="ambient-particle particle-three" />
      <span className="ambient-particle particle-four" />
      <span className="ambient-particle particle-five" />
      <span className="ambient-particle particle-six" />
      <span className="ambient-particle particle-seven" />
    </div>
  );
}