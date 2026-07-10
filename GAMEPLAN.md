Core idea

FTL: Faster Than Light is a real-time spaceship management roguelike. You control the ship rather than a single character.

During combat, you are constantly balancing:

ship power
crew positions
weapons and targeting
damaged systems
fires and hull breaches
oxygen
enemy boarding parties
your overall hull integrity

You can pause at any time, issue orders, then unpause. Pausing constantly is normal and important.

What “health” means in FTL

There are three separate kinds of health.

1. Hull health

This is the large hull bar at the top-left of the screen.

When it reaches zero, your ship is destroyed.

Most successful weapon hits reduce hull health by 1 or more points, depending on the weapon. Hull can usually only be repaired at stores, through certain events, or using a repair drone.

2. System health

Rooms containing systems have small system bars.

For example, a level-3 Shield system has three system bars. If it takes one system damage, one bar becomes broken, reducing the system to level 2 until repaired.

So the room itself does not have health. The system installed inside the room has functional bars.

A system can also have upgraded bars that are not currently powered. These still act as spare damage capacity.

Example:

Weapons system upgraded to 5 bars
Only 4 bars powered
Enemy deals 1 system damage
One bar breaks
You still have 4 usable bars, so your weapons may continue working normally

This is called damage buffering.

3. Crew health

Crew members normally have 100 health, although some species differ.

Crew lose health from:

enemy attacks
fire
lack of oxygen
explosions
hostile drones
certain environmental hazards

Crew heal in a functioning Medbay or Clone Bay-related situations.

How rooms work

Every tile on the ship belongs to a room. Rooms usually contain two or four crew positions.

Rooms may be:

empty
a system room
a subsystem room
occupied by crew
on fire
breached
without oxygen

Empty rooms do not have any special health. Hitting an empty room still damages the ship’s hull, but there is no system inside to disable.

Rooms with systems can suffer both:

hull damage
system damage

Crew standing in the room can repair damaged system bars.

Main systems and what their rooms do
Piloting

Piloting allows the ship to dodge attacks and jump between beacons.

Your engines can provide evasion only when:

Piloting is operational
a crew member is piloting, unless upgraded autopilot is available
Engines are powered

If Piloting is completely destroyed, your evasion becomes zero, and you cannot jump until it is repaired.

Higher Piloting levels provide better autopilot when no crew member is present.

A crew member can gain Piloting skill over time, improving evasion.

Engines

Engines increase:

evasion
FTL jump charging speed

More powered engine bars mean better evasion, provided Piloting is functioning.

A crew member stationed in Engines can improve evasion further and gains engine experience.

Damaged engine bars reduce the maximum engine power you can use.

Engines do not need to be fully powered permanently. Players often move power into Engines temporarily when enemy weapons are about to fire.

Shields

Each shield bubble absorbs one projectile or beam impact before collapsing.

Shield layers require two system bars each:

2 shield bars = 1 shield bubble
4 shield bars = 2 shield bubbles
6 shield bars = 3 shield bubbles
8 shield bars = 4 shield bubbles

Shields regenerate after being hit. A crew member in the Shield room increases recharge speed.

Different attacks interact with shields differently:

lasers remove one shield layer per projectile
missiles ignore shields
bombs teleport through shields
beams usually cannot penetrate shields unless their beam damage exceeds the number of shield layers
ion weapons temporarily disable shield power rather than directly breaking system bars

If the Shield system is damaged below the required number of bars, you lose shield layers.

Example: You have four shield bars, giving two bubbles. If one bar breaks, only three bars remain functional, so you drop to one bubble.

Weapons

The Weapons system determines how many weapon-power bars you can use.

Each weapon requires a certain amount of power. Weapons also need time to charge before firing.

Example:

Burst Laser II requires 2 power
Artemis Missile requires 1 power
You need at least 3 functioning and powered weapon bars to use both

When the Weapons system is damaged, powered weapons can shut down. The game normally depowers weapons according to their order and available bars.

Weapon charge is often lost when a weapon becomes unpowered.

A crew member in Weapons reduces weapon charge time.

Oxygen

The Oxygen system fills rooms with breathable air.

At normal operation, it gradually restores oxygen throughout the ship. Upgraded Oxygen works faster and can resist some forms of venting.

If Oxygen is destroyed or unpowered, air slowly disappears, especially from breached or open rooms.

Low oxygen damages most crew. Some species, such as Lanius, do not need oxygen.

Oxygen can also be used strategically. You can open doors to space and drain oxygen from rooms to extinguish fires or suffocate boarders.

Medbay

The Medbay heals friendly crew standing inside it while powered.

Higher levels heal faster.

It can also damage enemy crew in some circumstances if you have certain upgrades or augmentations, but normally it is primarily for healing your own crew.

A damaged or unpowered Medbay does nothing.

Clone Bay

The Clone Bay replaces the Medbay on some ships.

When crew die, they are added to a cloning queue and revived after a delay, provided the Clone Bay remains operational.

Higher levels clone faster and may restore more skill experience.

A major danger is having crew die while the Clone Bay is destroyed or unpowered. If it cannot finish cloning them, they may be permanently lost.

It also provides gradual healing after jumps rather than active room-based healing.

Doors

The Doors subsystem controls internal doors.

Higher levels make doors harder for enemies to break through.

Your own crew can normally move through your doors immediately. Enemy boarders must attack closed doors.

A crew member stationed in the Doors room temporarily adds another level to door strength.

If Doors is destroyed:

doors may become stuck open
you lose remote door control
controlling oxygen and fires becomes much harder

Doors do not normally consume reactor power because they are a subsystem.

Sensors

Sensors let you see information inside ships.

Basic Sensors allow you to see your own rooms.

Higher levels can show:

enemy room interiors and crew
enemy power distribution
additional combat information

A crew member stationed in Sensors can temporarily increase sensor effectiveness.

Sensors are less important during some environmental effects, such as nebulae, where they may be disabled.

Sensors are also a subsystem and normally do not consume reactor power.

Cloaking

Cloaking temporarily gives a large evasion bonus, generally allowing you to avoid incoming volleys.

It also pauses or slows certain enemy weapon charging interactions while active, depending on circumstances.

Higher Cloaking levels increase cloak duration.

Cloaking is most effective when activated just as dangerous shots are approaching, rather than immediately at the start of combat.

Firing most weapons while cloaked shortens the cloak duration, although certain augmentations can alter this.

Hacking

Hacking launches a drone onto an enemy system room.

Once attached, it:

locks the doors in that room
allows you to trigger a system-specific disruption
periodically interferes with that system

Examples:

hacking Shields drains shield layers
hacking Weapons reduces weapon charge progress
hacking Piloting reduces or removes enemy evasion
hacking Oxygen drains oxygen from the enemy ship
hacking Medbay harms crew instead of healing them
hacking Doors opens or interferes with doors
hacking Clone Bay can damage or disrupt cloning

Higher Hacking levels make the hacking pulse last longer.

It requires a drone part to launch.

Mind Control

Mind Control temporarily turns an enemy crew member against their own ship.

The controlled crew member may:

attack nearby allies
stop repairing
stop manning a system
distract defenders

You can also use Mind Control on your own mind-controlled crew member to cancel the enemy effect.

Higher levels increase the controlled target’s health and combat damage while controlled.

Mind Control only works when you can detect or target crew in the relevant room.

Teleporter

The Teleporter sends your crew onto the enemy ship.

You select a room and teleport a group based on the Teleporter room’s capacity.

Boarding allows you to:

kill enemy crew
disable systems directly
capture ships without destroying them
earn potentially better rewards

The Teleporter must recharge before bringing your crew back.

Higher levels reduce cooldown and can help operate through certain hazards.

Boarding is dangerous because your crew can be stranded if the Teleporter is damaged, unpowered, or destroyed.

Drone Control

Drone Control allows you to deploy drones.

Different drones include:

defensive drones that shoot down missiles or projectiles
combat drones that attack enemy ships
beam drones
anti-personnel drones
repair drones
boarding drones
system repair drones

Drones require:

sufficient Drone Control power
a drone part for initial deployment

Some drones remain active until destroyed or depowered.

Artillery

Certain ships have an Artillery system.

Artillery charges automatically while powered and fires a built-in weapon when fully charged.

Depending on the ship, it may fire:

a powerful beam
flak
another unique attack

Higher levels reduce the charge time.

You usually cannot choose exactly when or where some artillery weapons fire, making them powerful but less controllable.

Backup Battery

The Backup Battery temporarily provides extra power.

This power can be used for any power-consuming system, but only for a limited time.

It is useful for temporarily powering:

Engines during an enemy volley
Cloaking
additional weapons
extra shields
Oxygen during an emergency

When the battery expires, systems using that temporary power become depowered unless normal reactor power is available.

Fire mechanics

Fire is one of the most dangerous chain-reaction hazards in FTL.

What fire does

A fire inside a room:

damages crew standing in the room
gradually damages the system in that room
consumes oxygen
may spread to adjacent tiles or rooms
makes repairs difficult

A single fire can become multiple fire tiles if ignored.

Fire damage to a system happens over time. When enough damage accumulates, a system bar breaks. Continued fire can destroy additional system bars.

Fire does not directly reduce hull health simply by burning, but it can disable important systems and kill crew.

Some weapons, such as fire bombs or certain beams, have a high chance to start fires.

How to extinguish fire

There are two main methods.

Crew firefighting

Send crew into the room and have them extinguish it.

Crew automatically fight fires while standing on a burning tile.

Some species are better at this:

Rockmen are immune to fire damage
Engi repair systems quickly but are weak in combat
other species may be badly injured in large fires

Multiple crew extinguish a fire faster.

Venting the room

Open doors leading from the burning room to space.

The room loses oxygen. Fire weakens and eventually goes out when oxygen becomes sufficiently low.

A common technique is:

Move crew out of the affected area.
Close doors separating the fire from the inhabited section.
Open the burning rooms to an external airlock.
Let the oxygen drain.
Close the external doors after the fire goes out.
Restore oxygen.

This is often safer than sending crew into a large fire.

However, venting can be dangerous if:

the Doors subsystem is broken
the Oxygen system is damaged
crew become trapped
the fire is near critical rooms
a hull breach is also present
Hull breaches

A breach is a hole in the ship.

A breached room constantly loses oxygen, even when the doors are closed.

Crew can repair a breach by standing in the room and repairing it, but they may take suffocation damage while doing so.

Breaches:

drain room oxygen
make fires easier to extinguish
make the room dangerous for most crew
can prevent oxygen recovery until repaired

Lanius are especially useful in breached rooms because they do not need oxygen.

A breach does not continually drain hull health. It is an environmental hazard rather than a permanent hull-damage effect.

System damage versus ion damage

These are different.

Normal system damage

Normal damage breaks a system bar.

A crew member must repair it.

Example: A missile hits Weapons for 2 system damage. Two Weapon bars become broken and stay broken until repaired.

Ion damage

Ion damage temporarily locks system power bars.

Ionized bars recover after a timer.

You cannot repair ion damage because it is not physical damage.

Repeated ion hits can stack the duration.

Ion is particularly effective against Shields because disabling shield bars can remove shield layers without needing to physically damage the Shield room.

Manning systems

Crew can stand in certain system rooms to improve them.

The main manned systems are:

Piloting
Engines
Weapons
Shields

Crew gain experience while performing the related task.

Skilled crew provide larger bonuses:

Piloting skill increases evasion
Engine skill increases evasion
Weapon skill reduces weapon charge time
Shield skill reduces shield recharge time

Some other rooms, such as Doors and Sensors, gain a temporary extra level when manned, but crew do not develop normal skill levels for them.

If the crew member leaves, becomes stunned, fights an enemy, or dies, the manning bonus stops.

Power management

Most systems require reactor power.

You have:

a reactor with a limited number of power units
upgraded system bars that determine the maximum power a system can accept

Upgrading a system does not automatically give you enough reactor power to use it.

Example:

You upgrade Engines from level 3 to level 5
Your reactor may still only have enough spare power for three bars
You must upgrade the reactor or depower something else to use all five bars

Power can be moved during combat.

Common decisions include:

turning off Oxygen temporarily to power Engines
depowering Medbay when nobody needs healing
lowering Engines to power a newly charged weapon
moving power into Shields before an enemy drone fires
using Backup Battery for temporary capacity

Destroyed system bars cannot hold power until repaired.

Enemy attacks and room targeting

Most weapons can target a specific room.

When an attack hits a system room, it can cause:

hull damage
system damage
crew damage
fire
a breach
stun effects

Different weapons have different combinations.

For example:

a basic laser usually deals one hull and one system damage
a missile ignores shields and may cause fires or breaches
a beam damages every room it crosses
a bomb damages systems or crew but usually does not damage the hull
flak launches multiple projectiles with inaccurate impact zones

Targeting is a major part of the game.

Typical priority targets are:

Weapons, to stop incoming damage
Shields, to make later attacks land
Piloting or Engines, to reduce evasion
Medbay or Clone Bay, during boarding
Oxygen, for suffocation strategies
Crew combat inside rooms

When hostile crew enter the same room as your crew, they fight automatically.

Each crew member occupies one tile. In a two-tile room, only two crew from each side can actively fight at once. In a four-tile room, more combatants can engage.

You can manipulate boarding combat by:

moving injured crew out
rotating healthy crew in
venting rooms
locking doors
fighting inside your Medbay
using Mind Control
using anti-personnel drones

Boarders can also attack systems when no defenders are engaging them.

When they finish breaking a system bar, the system becomes less functional.

Oxygen movement between rooms

Oxygen equalizes through open doors.

Opening internal doors lets air move from oxygen-rich rooms into depleted rooms.

Opening a path to space drains every connected room.

Upgraded Doors slow enemy movement but do not stop oxygen flow when you deliberately leave doors open.

You can use door control tactically:

seal off fires
guide boarders into specific rooms
deprive boarders of oxygen
preserve oxygen in occupied areas
rapidly refill depleted rooms by opening several internal doors
Environmental hazards
Asteroid fields

Asteroids periodically strike both ships.

They behave like projectiles and can be blocked by shields.

A ship with weak Shields may be overwhelmed because asteroids continually remove shield layers.

Solar flares

Solar flares periodically start fires and can cause direct damage.

The game warns you before each flare, allowing you to prepare crew and doors.

Pulsars

Pulsars periodically ionize random systems on both ships.

This can suddenly disable Shields, Weapons, Engines, Oxygen, or other systems.

Nebulae

Nebulae interfere with Sensors and may produce unusual events.

Some nebula combat zones also reduce reactor power through ion storms.

Typical flow of a fight

A normal fight may look like this:

Pause immediately.
Examine the enemy’s weapons, shields, drones, and crew.
Allocate power.
Choose weapon targets.
Wait for weapons to charge.
Fire weapons together so they arrive as one volley.
Remove shields first, then damage a critical system.
React to fires, breaches, boarders, and damaged systems.
Repair after the enemy’s dangerous weapons are disabled.
Destroy the ship, force surrender, or kill its crew.

The key is to synchronize attacks. Firing one laser at a time against two shields may accomplish nothing. Firing several weapons together can strip the shields and let the rest of the volley damage the ship.

The most important distinction

FTL does not treat each room like it has its own independent health bar.

Instead:

the ship has hull health
the system inside a room has system bars
the crew inside the room have individual health
the room environment has oxygen, fire, and breach states

That separation is what creates the game’s complexity. A room can be physically intact but have no oxygen. A system can be fully repaired while the ship is nearly destroyed. A room can be on fire with no system inside. A system can be working despite one damaged bar because it has spare upgraded capacity.

can you move things around a ship?

Not really—the ship’s layout is fixed in normal FTL.

You can move:

Crew between rooms
Power between systems
Weapons and drones between equipment slots
Augments and cargo in your inventory
Boarders by teleporting them to different enemy rooms

You cannot move:

Rooms
Doors or airlocks
Systems such as Shields, Weapons, Medbay, or Engines
The position of weapon mounts
Crew stations within a room manually; crew choose available tiles automatically

You also cannot build new rooms or redesign the ship during a run. Upgrading a system adds more functional bars to the existing system room—it does not make the room larger.

Different playable ships and variants have different permanent layouts, so choosing a ship determines things such as:

how quickly crew can reach damaged rooms
which areas can be vented easily
where airlocks are located
how good the Medbay is for fighting boarders
whether important rooms are far apart

With external mods or a ship-layout editor, custom ships and rearranged rooms are possible, but not through ordinary gameplay.

Pasted text.txt
Document
how would a multiplayer with friends version work for this?


Worked for 15s

The strongest multiplayer version would be 2–5 friends operating one shared ship, rather than each player independently controlling a whole ship.

Think:

FTL’s ship management + Overcooked’s coordination chaos + a light D&D-style campaign.

The existing model already works well for multiplayer because hull health, system damage, crew health, oxygen, fires, and breaches are separate systems that different players can manage simultaneously.

The basic multiplayer concept

Everyone is on the same ship. The group travels through a procedurally generated sector, chooses encounters, fights enemies, collects scrap, upgrades the ship, and tries to reach a final objective.

However, instead of one player controlling everything, each person controls a department.

Player role	Main responsibility
Captain	Navigation, encounter decisions, ship-wide commands
Weapons Officer	Targeting, firing, missiles and weapon combinations
Engineer	Reactor power, repairs, shields and engines
Security/Medic	Crew movement, boarders, doors and healing
Science Officer	Sensors, hacking, drones and enemy analysis

These should be soft roles, not permanent classes. Anyone can help with another department during an emergency.

For example, the Weapons Officer might normally control weapons, but if Engineering catches fire, they can send one of their crew members to help.

What each player actually controls

Each player would control one or two named crew members and receive special access to certain ship interfaces.

For example:

Captain

The Captain sees the sector map and makes navigation decisions.

They can:

select the next destination
negotiate during encounters
order retreat
activate limited tactical slow-motion
place priority markers on rooms
call out targets
assign temporary objectives

The Captain should not directly command everyone. Instead, they create shared priorities such as:

“Disable enemy weapons”
“Prepare to board”
“Repair oxygen immediately”
“Charge the FTL drive”

Other players decide how to fulfil those priorities.

Weapons Officer

The Weapons Officer manages the ship’s offensive systems.

They:

choose which weapons are powered
wait for weapons to charge
select enemy rooms
coordinate volleys
manage ammunition
decide whether to target systems or crew
operate artillery or boarding weapons

A good Weapons Officer needs to communicate with Engineering.

For example:

“I need two more power for the railgun.”

Engineering may have to take power away from Oxygen or Engines temporarily.

The Weapons Officer also communicates with Science:

“Can you hack their shields before my missiles arrive?”

Engineer

The Engineer manages the reactor and the physical condition of the ship.

They:

distribute reactor power
repair damaged systems
manage shields
boost engines
restore oxygen
handle breaches
reroute emergency power

The Engineer may have a simplified power-grid interface.

For example, the ship has 12 power units:

Shields: 4
Weapons: 4
Engines: 2
Oxygen: 1
Medbay: 1

When a dangerous missile volley approaches, Engineering might temporarily turn off the Medbay and Oxygen to increase Engines from two power to four power.

The ship gains more evasion, but everyone now has limited time before oxygen becomes a problem.

Security and Medical

This player manages internal threats.

They:

move crew between rooms
fight enemy boarders
lock and open doors
vent rooms
extinguish fires
operate the Medbay or Clone Bay
rescue injured crew

This role becomes extremely important when several emergencies happen together.

For example:

two enemies teleport into Weapons
a fire starts in Shields
Oxygen is damaged
one crew member is nearly dead

The Security player must decide what is most urgent.

Science Officer

Science controls information and advanced systems.

They:

scan enemy rooms
identify enemy weapon timings
hack enemy systems
deploy drones
operate cloaking or electronic warfare
detect hidden weaknesses
improve rewards from events

Without functioning Sensors, Science may only see vague information.

For example:

“High-energy weapon detected”
“Life signs in three rooms”
“Enemy shields vulnerable to ion damage”

With upgraded Sensors, they see exact weapon charge times, crew positions, and system power.

How combat would work

A battle would have four repeating stages.

1. Contact phase

The enemy appears.

The game briefly freezes for around 10–15 seconds.

Players can inspect:

the enemy ship
visible weapons
environmental hazards
possible objectives
their own ship condition

The group discusses a plan.

For example:

Captain: “Their missiles are the main threat.”
Science: “I can hack their Weapons room.”
Weapons: “I’ll fire lasers into Shields and then missile Weapons.”
Engineer: “I’ll keep four power in Engines until the first volley passes.”

2. Real-time execution

The game begins moving in real time.

Players perform their tasks simultaneously:

Weapons charges and aims
Science launches the hacking drone
Engineering moves power around
Security positions crew near vulnerable rooms
Captain watches the overall situation

Unlike single-player FTL, normal multiplayer should probably not allow unlimited pausing. One person constantly pausing would interrupt everyone else.

Instead, use tactical slow-motion.

Tactical slow-motion

The team has a shared resource called something like Command Focus.

The Captain—or possibly any player—can activate it.

For five seconds:

game speed drops to 20–30%
players can queue commands
incoming projectiles move slowly
everyone can communicate
each player can issue a limited number of orders

It then goes on cooldown.

This keeps the tactical feeling of FTL without allowing one player to freeze the game every second.

A simpler option is to let any player request a pause, but require two players to approve it. That may become annoying, though, so slow-motion is probably better.

3. Crisis phase

Something goes wrong.

For example:

a missile hits the Engine room
the hit causes a hull breach
Engines lose two system bars
a second attack starts a fire in Weapons
enemy boarders enter the Medbay

Players must abandon their original plan.

Engineering sends a repair crew to Engines.

Security vents the corridor outside the Medbay.

Weapons loses one powered weapon because the Weapons system is damaged.

The Captain must decide whether to continue fighting or charge the FTL drive.

This is where the multiplayer game becomes entertaining. The fun comes from multiple interconnected problems occurring faster than the team can solve them.

4. Resolution phase

The battle ends because:

the enemy ship is destroyed
its crew surrenders
its crew is defeated
the players escape
the enemy escapes
the players’ ship is destroyed

The team receives scrap, fuel, equipment, or crew.

They then repair and upgrade before the next encounter.

How rooms would work

Every room would have several independent states.

Room structure

A room could contain:

a ship system
crew positions
oxygen
fires
breaches
doors
items or temporary objects

The room itself would not have a conventional health bar.

Instead, it might display:

System integrity: 2/4
Oxygen: 63%
Fire tiles: 1
Breach severity: Minor
Crew: 2 friendly, 1 hostile
System damage

If the Weapons room has four system bars and takes two damage:

two bars remain operational
only two weapon-power units can be used
some weapons automatically shut down
crew must enter the room to repair it

Engineering may send an engineer there, but that leaves another room unstaffed.

Fire

Fire should create escalating multiplayer problems.

A fire:

consumes room oxygen
injures crew
damages the system
can spread to adjacent tiles
blocks safe repairs
produces smoke that reduces visibility

Players have several options.

Fight the fire manually

Security sends crew into the room.

This is fast but dangerous.

Vent the fire

The Doors operator opens a path to space.

The fire loses oxygen and goes out, but the room becomes uninhabitable.

Isolate it

Close the surrounding doors and allow the room to burn temporarily.

This protects the rest of the ship, but the system inside may be destroyed.

This creates arguments and decisions:

Weapons Officer: “Don’t vent Weapons; my crew is still inside!”
Security: “Get them out now, the fire is spreading.”
Engineer: “If Weapons goes down, we can’t stop their next attack.”

Hull breach

A breach continuously drains oxygen from the room.

Larger breaches could drain oxygen faster and require more repair time.

You could have breach levels:

minor crack
major breach
exposed hull

Repairing a major breach may require:

an engineering crew member
a repair tool
several uninterrupted seconds

While repairing it, the crew member takes suffocation damage unless they have protective equipment.

Crew control

Each player should directly control only a limited number of crew.

For a four-player game, the ship might begin with eight crew:

Captain controls two command crew
Weapons controls two gunners
Engineer controls two engineers
Security controls two security officers

Players click rooms to move their crew.

Crew automatically:

repair damaged systems
extinguish fires
fight enemies
operate the room’s system
heal when inside the Medbay

However, each player could also have one active ability.

Examples:

Engineer ability: Emergency Patch

Instantly restores one damaged system bar, but only temporarily. It breaks again after 20 seconds unless properly repaired.

Weapons ability: Manual Aim

The next weapon attack gains increased accuracy against one selected room.

Security ability: Lockdown

Temporarily reinforces all doors surrounding one room.

Science ability: Overload

Temporarily disables one enemy system but risks damaging your own Hacking system.

Captain ability: Brace for Impact

Reduces crew and system damage from the next enemy volley.

Communication should be part of the mechanics

The game should encourage communication without requiring players to explain every tiny action.

Players could ping rooms or systems.

Examples:

red ping: urgent threat
yellow ping: needs attention
blue ping: planned action
green ping: safe or completed

A player could ping Weapons and automatically display:

Weapons requires 2 more power.

Or ping an enemy room:

Planned missile target: Enemy Shields.

The game could also provide quick voice-style messages:

“Need power!”
“Incoming boarders!”
“Prepare to vent!”
“Weapon ready!”
“Crew trapped!”
“Jump drive charged!”

This helps players who are not using voice chat.

Ship movement and customisation

A multiplayer version could improve on FTL by allowing the team to rearrange the ship between encounters.

During combat, rooms remain fixed.

At safe locations, players could move modules around a grid.

For example:

place the Medbay near the centre of the ship
put Weapons near an airlock for easier fire venting
place Shields near Engineering for faster repairs
position the Teleporter close to the Medbay
build reinforced corridors around Piloting

Moving systems should have trade-offs.

Room adjacency bonuses

Rooms next to one another could provide benefits.

Examples:

Reactor beside Engines: faster power rerouting
Medbay beside Teleporter: returning boarders heal faster
Sensors beside Weapons: increased weapon accuracy
Drone Control beside Engineering: faster drone repair
Shields beside Reactor: faster shield recharge

But clustering important systems creates vulnerability. One large beam or boarding attack could disable several critical rooms.

Ship mass

Adding rooms increases ship mass.

More mass could mean:

slower FTL charging
lower evasion
greater fuel consumption
more hull health
more crew capacity

This prevents players from simply building every possible room.

Shared upgrades

After a battle, the team receives scrap.

The players must decide how to spend it.

Possible upgrades:

stronger shields
more reactor capacity
better weapons
reinforced doors
larger oxygen reserves
more crew
improved medical systems
new rooms
armour plating
automated repair systems

To prevent one player from controlling every purchase, each player could propose one upgrade.

The team then votes.

For example:

Weapons proposes another laser
Engineering proposes reactor capacity
Security proposes stronger doors
Science proposes Hacking level 2

The group has enough scrap for only one.

That produces natural friendly arguments without requiring hidden traitors or artificial conflict.

Boarding gameplay

Boarding becomes especially interesting in multiplayer.

One or two players can send their crew onto the enemy ship.

The boarding player controls the team inside the enemy ship while everyone else protects the friendly ship.

For example:

Science hacks the enemy Medbay.
Weapons damages the enemy Doors.
Security teleports two fighters into Shields.
Engineering powers the Teleporter and Clone Bay.
Captain watches for enemy reinforcements.

The boarding crew attacks the enemy Shield system.

But then the enemy teleports boarders onto the players’ ship.

Security now has to decide whether to control the away team or defend the home ship.

This suggests that boarding control should be transferable. Another player could temporarily take over the away team.

Player death

Individual players should not be removed from the game for long.

If a player’s crew member dies:

the Clone Bay can revive them
another unassigned crew member can be taken over
they can temporarily control a repair drone
they can operate ship systems remotely
they can respawn after the encounter

Permanent crew death can still exist, but the human player should always retain something meaningful to do.

Otherwise, one unlucky missile could leave a friend spectating for 30 minutes.

Campaign structure

For a friends-based game, I would make runs shorter than FTL.

A good structure might be:

3 sectors
4–6 encounters per sector
one miniboss per sector
one final boss
45–75 minutes for a full run

For a quicker party mode:

8 encounters total
one boss
25–40-minute run

Each encounter could be:

ship combat
rescue mission
derelict exploration
trade event
crew dispute
environmental hazard
boarding defence
negotiation
strange anomaly
Different multiplayer modes
Shared Ship Co-op

All players operate one ship.

This should be the main mode because it creates the most communication and chaos.

Fleet Co-op

Each player controls a smaller ship.

Players fight the same enemies as a formation.

One ship might specialise in shields, another in missiles, another in boarding.

This is easier to understand but loses some of the “everyone is trapped in one failing machine” feeling.

Two-Ship Teams

Two teams each operate a ship.

This could be:

direct PvP
a race through the same sector
asymmetric objectives
one team hunting the other

However, competitive PvP would be difficult to balance because disabling a critical system can cause a losing team to snowball quickly.

Hidden Saboteur

One player secretly receives objectives that harm the ship.

For example:

waste fuel
keep a specific alien alive
damage a room
cause the team to choose dangerous routes

This could be an optional party mode, but it should not be the core game. The normal mechanics already create enough conflict.

Preventing the “captain controls everything” problem

The largest design risk is one experienced player ordering everyone around.

Several mechanics can reduce this.

Private information

Different players see different information.

For example:

Science sees enemy weapon details
Engineering sees exact power efficiency
Security sees crew health and oxygen routes
Weapons sees accuracy and damage estimates

The Captain depends on the others to explain what they see.

Limited control permissions

The Captain can issue priorities but cannot directly fire Weapons or move Engineering’s crew.

They must communicate rather than taking over.

Simultaneous emergencies

Create enough parallel problems that one person cannot micromanage all of them.

During a difficult fight:

Weapons must plan a volley
Engineering must restore Shields
Security must stop boarders
Science must counter an enemy hack
Captain must choose whether to retreat
Role-specific mastery

Each role should have a small skill game.

For example:

Weapons times shots and predicts projectile travel
Engineering manages fluctuating power loads
Science solves short signal-routing puzzles
Security positions crew and controls door pressure
Captain chooses routes and negotiates events

That gives everyone ownership over their station.

An example multiplayer battle

Four friends enter an asteroid field and encounter a pirate cruiser.

The pirate has:

two shield layers
a missile launcher
a beam weapon
a Teleporter
six crew members

The battle begins.

The Captain marks the missile launcher as the priority target.

Science scans the enemy and discovers that its Engines are weak.

Weapons prepares a laser and missile combination.

Engineering places four power into Shields and three into Engines, leaving the Medbay unpowered.

The enemy teleports two boarders into Oxygen.

Security sends two crew members to fight them, then locks the surrounding doors.

The pirate missile fires.

The Captain activates tactical slow-motion.

Engineering takes one power from Weapons and moves it into Engines.

The ship narrowly dodges the missile.

Weapons complains that the missile launcher is now unpowered.

The asteroid field knocks down one enemy shield layer.

Science activates a Shield hack.

Weapons restores the missile launcher, fires the laser, then launches the missile into the enemy Weapons room.

The enemy Weapons room catches fire.

Meanwhile, one of the boarders damages Oxygen.

Security vents the adjacent room, forcing the boarders toward the Medbay.

Engineering restores power to the Medbay just before Security’s injured crew arrive.

The pirate offers to surrender and provides a new drone schematic.

The team must decide whether to accept or risk continuing the fight for more scrap.

That is essentially the desired multiplayer experience: planned teamwork repeatedly collapsing into shared panic.

The version I would build first

For an initial browser-based prototype:

3 players
one shared ship
six rooms
one crew member per player
Captain, Weapons and Engineering roles
real-time combat
tactical slow-motion
fires, breaches and oxygen
four weapon types
four enemy ship types
five encounters and one boss
around 20–30 minutes per run

I would initially exclude:

boarding
hacking
drones
movable ship rooms
large narrative events
complicated crew species

First prove that these three interactions are fun:

Engineering gives and removes power.
Weapons coordinates attack timing.
Everyone responds to internal damage together.

Once that works, boarding, room rearrangement and additional roles can be layered on top.