# Dungeonslop v0 — Multiplayer Ship Design

**Status:** approved direction; replaces the tactical dungeon-board design
**Revised:** 2026-07-10
**Goal:** Make a replayable 2–4 player browser game in which friends each control one crew member aboard the same failing ship, survive a branching run, and vote on major ship decisions.

## 1. Product promise

Dungeonslop is ship friendslop: a multiplayer FTL-like run with individually controlled crew.

Each player moves one character around a shared vessel and operates stations, repairs systems, fights boarders, carries items, and responds to emergencies in real time. Between encounters the crew votes on routes, events, purchases, and ship upgrades. The party wins or loses together.

The fun should come from human coordination under pressure:

- several urgent problems happening at once;
- players abandoning one responsibility to solve another;
- incomplete or role-specific information;
- consequential group votes;
- recoverable disasters that produce stories instead of immediate failure.

The v0 objective is explicit: cross three sectors and survive the final encounter. A run should last roughly 35–60 minutes.

## 2. Design pillars

### Shared vessel, individual bodies

Every player controls exactly one visible crew member. Crew can move, interact, repair, carry one item, and perform a role ability. Nobody directly commands another player's character.

### Simultaneous crisis management

Encounters run in real time. Weapons charge, damage disables systems, fire spreads, hull breaches drain oxygen, and boarders sabotage rooms. No normal tactical pause exists in multiplayer.

### Cooperation with social friction

Players need one another, but disagree over scarce power, scrap, route choices, upgrades, and risk. Social conflict comes from competing priorities and imperfect information, not unrestricted griefing or a separate PvP victory condition.

### Systems create stories

Replayability comes from combinations of ship layout, sector map, encounters, upgrades, crew roles, damage, and Slop effects. Content that only changes a number is lower priority than content that changes player behavior.

### Recoverable failure

Bad decisions should cause cascading trouble while leaving room for an unlikely recovery. Hull reaching zero or the whole crew becoming incapacitated ends the run; losing one room or system should not.

## 3. v0 scope

### Included

- 2–4 player online rooms with join codes, names, role selection, and ready state.
- One shared ship layout with connected rooms and doors.
- Direct character movement and interaction.
- Four roles: Pilot, Engineer, Gunner, and Medic.
- Five ship systems: helm, reactor, weapons, shields, and oxygen.
- Hull integrity, system health, ship power, room oxygen, fire, and breaches.
- Simple enemy ships driven by charge timers and behavior profiles.
- One simple boarder type using room-to-room pursuit and sabotage.
- A branching run of three sectors, approximately 3–4 nodes each.
- Encounter types: ship combat, environmental emergency, trader, and authored event.
- Scrap economy, repairs, and a small pool of ship upgrades.
- Majority votes for route, event, and upgrade decisions.
- One Slop effect per sector that changes crew behavior or ship operation.
- Final encounter plus victory and defeat screens.
- Reconnect grace period for a disconnected seat.

### Explicitly deferred

- Accounts, persistence, matchmaking, progression, achievements, and leaderboards.
- Multiple player ships or procedural ship-layout generation.
- Complex enemy crew simulation or tactical monster rosters.
- Freeform PvP, traitor roles, secret personal victory conditions, and individual scoring.
- Voice chat; players use their existing call setup.
- Mobile controls and gamepad support.
- Hand-authored 3D assets. v0 uses a readable top-down presentation built from primitives.

## 4. Run structure

### Lobby

Create or join a room, enter a name, select a role, and ready up. Duplicate roles are allowed, although the lobby indicates uncovered specialties. When all players are ready, the host starts the run.

### Sector map

Each sector presents a small branching graph. The crew sees two or three reachable nodes and votes before a short timer expires. A majority selects the destination. On a tie, a rotating captain chooses among the tied options. Captaincy rotates after every resolved node.

### Encounter

An encounter is either active or deliberative:

- **Active:** real-time ship combat, boarding, or environmental emergency.
- **Deliberative:** trader or authored event with a timed group choice.

Active encounters should last 2–5 minutes. More than one station must matter, and at least two concurrent problems should arise during a typical encounter.

### Recovery

After an encounter, award scrap and show the ship's condition. The crew may vote to repair, buy, or install an offered upgrade. Routine character actions never require a vote.

### End state

After three sectors, the ship enters a final encounter that tests several systems. Surviving it wins the run. Hull destruction or total crew incapacitation loses the run.

## 5. Player controls and roles

All crew share these verbs:

- move through rooms and doors;
- interact with a station or object;
- repair a damaged system;
- extinguish fire;
- seal a breach;
- carry or drop one item;
- attack a nearby boarder;
- revive an incapacitated crewmate.

Roles add a passive and one cooldown ability without restricting basic verbs:

| Role | Passive | Ability |
| --- | --- | --- |
| Pilot | Better evasion while operating helm | Emergency Burn: brief evasion spike |
| Engineer | Repairs and power routing are faster | Overcharge: temporarily add power at a heat cost |
| Gunner | Weapons charge faster while manned | Called Shot: next volley targets one enemy system |
| Medic | Healing and reviving are faster | Stabilize: prevent nearby crew from becoming incapacitated |

Leaving a station is always allowed. Roles create responsibility, not chores or hard locks.

## 6. Ship simulation

The ship is a graph of rooms connected by doors. Movement and hazards use this graph; v0 does not need a tactical tile grid.

### Resources

- **Hull:** shared ship health; zero ends the run.
- **Power:** produced by the reactor and allocated to systems.
- **System health:** controls whether a system works and at what efficiency.
- **Oxygen:** tracked per room and equalizes through open doors.
- **Scrap:** shared currency spent only through crew decisions.

### Systems

- **Helm:** enables evasion when powered and crewed.
- **Reactor:** determines total available power; overloading risks fire.
- **Weapons:** charges and fires installed weapons.
- **Shields:** regenerates shield layers while powered.
- **Oxygen:** replenishes breathable rooms.

### Hazards

- Fire damages crew and systems and may spread to an adjacent room.
- Breaches drain room oxygen until sealed.
- Disabled doors may trap or expose crew.
- Low oxygen damages crew.
- Crew become incapacitated before death, leaving a rescue window.

The simulation advances on a fixed server tick and uses seeded randomness. The server is authoritative.

## 7. Enemy behavior without complex AI

Enemy ships are system profiles, not fully simulated copies of the player ship. A profile defines hull, shields, weapon timers, targeting weights, and optional boarder timing.

On each server tick an enemy:

1. charges enabled weapons;
2. chooses a player system using its targeting weights;
3. fires when charged;
4. optionally launches a boarder on a fixed trigger.

Boarders use room-level behavior only: enter, choose the nearest occupied or functioning system room, move along the shortest door path, attack nearby crew, or sabotage the room. This is the only spatial enemy AI required for v0.

## 8. Voting and social decisions

Votes are limited to irreversible shared decisions:

- next map node;
- event response;
- scrap purchase or repair package;
- ship upgrade installation.

Votes have a visible 20-second timer. Players may change their vote until resolution. Majority wins; a rotating captain breaks ties. Abstaining does not block the game.

Some events may give different roles one extra sentence of information. The information must be accurate but incomplete, encouraging conversation without requiring deception.

## 9. Upgrades and Slop

Upgrades should create new coordination patterns. Initial examples:

- Backup Battery: temporary reserve power controlled from engineering.
- Teleporter: send one crew member to sabotage an enemy system.
- Blast Doors: slower doors that resist fire and boarders.
- Medbay Foam: healing also extinguishes fire in the medbay.
- Jury-Rigged Turret: automated defense that consumes reactor power.

At the start of each sector, reveal one Slop effect. Good Slop changes behavior visibly:

- **Crossed Wires:** station labels periodically swap, but room positions do not.
- **Union Break:** a station loses efficiency if the same player mans it too long.
- **Hot Reactor Summer:** extra reactor power slowly heats engineering and may ignite it.
- **Open-Door Policy:** doors reopen several seconds after being closed.
- **Shared Custody:** the captain role rotates whenever the ship takes hull damage.
- **Wrong Teleporter:** teleporting chooses between two marked destinations at the last moment.

Avoid filler such as `+10% enemy health` unless it supports a more meaningful rule.

## 10. Technical architecture

Keep the existing top-level packages:

```text
dungeonslop/
  backend/
    shared/   pure simulation, content, schemas, seeded RNG
    server/   authoritative Colyseus rooms and fixed-tick run loop
  frontend/   Vite + React client and ship presentation
```

- **Bun** is the runtime and package manager.
- **Shared** owns serializable state, content definitions, validation, and pure transition functions.
- **Server** owns time, votes, RNG, connection-to-crew mapping, and all accepted commands.
- **Frontend** renders snapshots/interpolation and sends player commands. It never resolves outcomes.
- State is ephemeral in v0 and disappears when the room closes.

### Network commands

Lobby: `setName`, `setRole`, `toggleReady`, `start`.

Run: `move`, `interact`, `useAbility`, `dropItem`, `attackBoarder`, `vote`, and `captainTieBreak`.

The server rejects commands from the wrong crew owner, invalid transitions, impossible paths, unavailable interactions, and expired votes.

## 11. Presentation

Use a readable top-down cutaway ship. Rooms, doors, stations, crew, boarders, fires, breaches, oxygen, and interaction targets must be distinguishable at a glance. Primitive 3D or 2.5D geometry is acceptable, but clarity is more important than spectacle.

The HUD shows hull, shields, power, current objective, encounter threat, crew condition, and contextual interaction. Voting appears as a shared overlay without obscuring active emergencies.

Audio cues are high value: weapon charged, hull hit, new fire, oxygen warning, vote countdown, incapacitation, and encounter completion.

## 12. v0 success criteria

The first fun-check succeeds when four friends can complete a 20-minute shortened run and, without prompting:

- divide responsibilities;
- call out at least one urgent problem;
- disagree over at least one group decision;
- recover from at least one cascading failure;
- identify who caused or solved a memorable incident;
- ask to play another run.

Content count is not a success metric until this loop works.
