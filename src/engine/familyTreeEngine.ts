import {
  FamilyTreePerson,
  FamilyTreeState,
  GameState,
  INITIAL_FAMILY_TREE_STATE,
  RelationshipChild,
  RelationshipConnection,
} from '../types/game';

function globalWeekFallback(state: Pick<GameState, 'year' | 'week'>): number {
  return ((state.year ?? 1) - 1) * 20 + (state.week ?? 1);
}

function playerTreeId(generation: number): string {
  return `player:g${generation}`;
}

function partnerTreeId(partnerId: string): string {
  return `partner:${partnerId}`;
}

function childTreeId(childId: string): string {
  return `person:${childId}`;
}

function descendantTreeId(descendantId: string): string {
  return `person:${descendantId}`;
}

function upsert(people: FamilyTreePerson[], person: FamilyTreePerson): FamilyTreePerson[] {
  const index = people.findIndex((item) => item.id === person.id);
  if (index < 0) return [...people, person];
  const next = [...people];
  next[index] = {
    ...next[index],
    ...person,
    parentIds: [...new Set([...(next[index].parentIds ?? []), ...(person.parentIds ?? [])])],
    partnerIds: [...new Set([...(next[index].partnerIds ?? []), ...(person.partnerIds ?? [])])],
    childIds: [...new Set([...(next[index].childIds ?? []), ...(person.childIds ?? [])])],
  };
  return next;
}

function occupationForPlayer(state: GameState): string | null {
  if (state.career?.companyId) return 'Career Professional';
  if (state.currentJobId) return state.currentJobId.replace(/_/g, ' ');
  if ((state.businesses ?? []).length > 0) return 'Business Owner';
  return null;
}

function makeChildNode(
  state: GameState,
  child: RelationshipChild,
  parentId: string,
  otherParentId: string | null,
): FamilyTreePerson {
  const birthYear = Math.max(1, state.year - Math.max(0, child.age ?? 0));
  return {
    id: childTreeId(child.id),
    name: child.name,
    gender: child.gender,
    generation: (state.generation ?? 1) + 1,
    status: 'living',
    age: child.age ?? 0,
    birthYear,
    occupationTitle: child.occupationTitle ?? null,
    parentIds: [parentId, ...(otherParentId ? [otherParentId] : [])],
    partnerIds: child.partnerName ? [`inlaw:${child.id}`] : [],
    childIds: (child.descendants ?? []).map((descendant) => descendantTreeId(descendant.id)),
    playableGeneration: null,
  };
}

export function createInitialFamilyTree(
  playerName: string,
  age: number,
  year: number,
  generation = 1,
): FamilyTreeState {
  const id = playerTreeId(generation);
  return {
    currentPlayerId: id,
    people: [{
      id,
      name: playerName,
      generation,
      status: 'living',
      age,
      birthYear: Math.max(1, year - age),
      parentIds: [],
      partnerIds: [],
      childIds: [],
      playableGeneration: generation,
      occupationTitle: null,
    }],
  };
}

export function syncFamilyTree(state: GameState): FamilyTreeState {
  let tree = state.familyTree ?? { ...INITIAL_FAMILY_TREE_STATE, people: [] };
  let people = [...(tree.people ?? [])];
  const generation = state.generation ?? 1;
  const currentId = tree.currentPlayerId ?? playerTreeId(generation);

  const activePartner = state.relationshipState?.partnerId
    ? (state.relationshipState?.activeConnections ?? []).find((item) => item.id === state.relationshipState.partnerId) ?? null
    : null;
  const activePartnerId = activePartner
    ? (activePartner.familyTreePersonId ?? partnerTreeId(activePartner.id))
    : null;

  const childNodes = (state.relationshipState?.children ?? []).map((child) => {
    const recordedOtherParent = child.otherParentId
      ? (state.relationshipState?.activeConnections ?? [])
          .concat(state.relationshipState?.formerPartners ?? [])
          .find((partner) => partner.id === child.otherParentId)
      : null;
    const otherParentId = recordedOtherParent
      ? (recordedOtherParent.familyTreePersonId ?? partnerTreeId(recordedOtherParent.id))
      : activePartnerId;
    return makeChildNode(state, child, currentId, otherParentId);
  });

  const existingCurrent = people.find((person) => person.id === currentId);
  const currentNode: FamilyTreePerson = {
    id: currentId,
    name: state.playerName,
    gender: existingCurrent?.gender ?? null,
    generation,
    status: state.lifecycle?.isDead ? 'deceased' : 'living',
    age: state.age,
    birthYear: existingCurrent?.birthYear ?? Math.max(1, state.year - state.age),
    deathYear: state.lifecycle?.isDead ? state.lifecycle.deathYear ?? state.year : existingCurrent?.deathYear ?? null,
    deathAge: state.lifecycle?.isDead ? state.lifecycle.deathAge ?? state.age : existingCurrent?.deathAge ?? null,
    occupationTitle: occupationForPlayer(state) ?? existingCurrent?.occupationTitle ?? null,
    parentIds: existingCurrent?.parentIds ?? [],
    partnerIds: [
      ...(existingCurrent?.partnerIds ?? []),
      ...(activePartnerId ? [activePartnerId] : []),
      ...(state.relationshipState?.formerPartners ?? []).map((partner) => partner.familyTreePersonId ?? partnerTreeId(partner.id)),
    ],
    childIds: [...new Set([...(existingCurrent?.childIds ?? []), ...childNodes.map((child) => child.id)])],
    playableGeneration: generation,
    finalNetWorth: state.lifecycle?.isDead
      ? state.relationshipState?.estateSettlement?.netEstate ?? existingCurrent?.finalNetWorth ?? null
      : existingCurrent?.finalNetWorth ?? null,
  };
  people = upsert(people, currentNode);

  const allPartners: RelationshipConnection[] = [
    ...(state.relationshipState?.activeConnections ?? []),
    ...(state.relationshipState?.formerPartners ?? []),
  ];
  for (const partner of allPartners) {
    if (partner.stage === 'dating') continue;
    const id = partner.familyTreePersonId ?? partnerTreeId(partner.id);
    const existing = people.find((person) => person.id === id);
    const isFormer = (state.relationshipState?.formerPartners ?? []).some((item) => item.id === partner.id);
    people = upsert(people, {
      id,
      name: partner.name,
      gender: partner.gender,
      generation,
      status: partner.endedReason === 'death' ? 'deceased' : existing?.status ?? 'living',
      age: partner.age ?? existing?.age ?? 18,
      birthYear: existing?.birthYear ?? Math.max(1, state.year - (partner.age ?? 18)),
      occupationTitle: partner.occupationTitle ?? existing?.occupationTitle ?? null,
      parentIds: existing?.parentIds ?? [],
      partnerIds: [...new Set([...(existing?.partnerIds ?? []), currentId])],
      childIds: isFormer ? existing?.childIds ?? [] : childNodes.map((child) => child.id),
      playableGeneration: existing?.playableGeneration ?? null,
      deathAge: partner.endedReason === 'death' ? partner.age ?? existing?.deathAge ?? null : existing?.deathAge ?? null,
      deathYear: partner.endedReason === 'death'
        ? Math.max(1, Math.floor(((partner.endedWeek ?? globalWeekFallback(state)) - 1) / 20) + 1)
        : existing?.deathYear ?? null,
    });
  }

  for (const child of state.relationshipState?.children ?? []) {
    const recordedOtherParent = child.otherParentId
      ? allPartners.find((partner) => partner.id === child.otherParentId) ?? null
      : null;
    const childOtherParentId = recordedOtherParent
      ? (recordedOtherParent.familyTreePersonId ?? partnerTreeId(recordedOtherParent.id))
      : activePartnerId;
    const node = makeChildNode(state, child, currentId, childOtherParentId);
    const existing = people.find((person) => person.id === node.id);
    people = upsert(people, { ...node, playableGeneration: existing?.playableGeneration ?? null });

    if (child.partnerName) {
      const inlawId = `inlaw:${child.id}`;
      const inlawExisting = people.find((person) => person.id === inlawId);
      people = upsert(people, {
        id: inlawId,
        name: child.partnerName,
        gender: child.partnerGender ?? inlawExisting?.gender ?? null,
        generation: generation + 1,
        status: inlawExisting?.status ?? 'living',
        age: inlawExisting?.age ?? Math.max(18, child.age ?? 18),
        birthYear: inlawExisting?.birthYear ?? Math.max(1, state.year - Math.max(18, child.age ?? 18)),
        occupationTitle: inlawExisting?.occupationTitle ?? null,
        parentIds: inlawExisting?.parentIds ?? [],
        partnerIds: [node.id],
        childIds: (child.descendants ?? []).map((descendant) => descendantTreeId(descendant.id)),
        playableGeneration: inlawExisting?.playableGeneration ?? null,
      });
    }

    for (const descendant of child.descendants ?? []) {
      const id = descendantTreeId(descendant.id);
      const existingDesc = people.find((person) => person.id === id);
      people = upsert(people, {
        id,
        name: descendant.name,
        gender: descendant.gender,
        generation: generation + 2,
        status: existingDesc?.status ?? 'living',
        age: descendant.age ?? 0,
        birthYear: existingDesc?.birthYear ?? Math.max(1, state.year - (descendant.age ?? 0)),
        occupationTitle: existingDesc?.occupationTitle ?? null,
        parentIds: [node.id, ...(child.partnerName ? [`inlaw:${child.id}`] : [])],
        partnerIds: existingDesc?.partnerIds ?? [],
        childIds: existingDesc?.childIds ?? [],
        playableGeneration: existingDesc?.playableGeneration ?? null,
      });
    }
  }

  return {
    currentPlayerId: currentId,
    people,
  };
}

export function transitionFamilyTreeToChild(
  state: GameState,
  childId: string,
  nextGeneration: number,
): FamilyTreeState {
  const synced = syncFamilyTree(state);
  const targetId = childTreeId(childId);
  const target = synced.people.find((person) => person.id === targetId);
  if (!target) return synced;

  return {
    currentPlayerId: targetId,
    people: synced.people.map((person) => {
      if (person.id !== targetId) return person;
      return {
        ...person,
        generation: nextGeneration,
        playableGeneration: nextGeneration,
        status: 'living',
      };
    }),
  };
}

export function getFamilyTreePersonIdForChild(childId: string): string {
  return childTreeId(childId);
}
