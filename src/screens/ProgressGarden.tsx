import React, { useMemo, useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';

import { useCollection } from '../app/AppContext';
import { tzOffset } from '../app/actions';
import {
  monthlyMinutes,
  moduleAnalytics,
} from '../core/focus/analytics';
import {
  MAX_TASK_FLOWERS_PER_DAY,
  layout,
  summarize,
} from '../core/focus/garden';
import { currentStreak } from '../core/focus/streak';
import {
  BackableHeader,
  OutlinedField,
  Panel,
  Row,
  Screen,
  T,
  useColors,
} from '../ui/kit';
import { FlowerSpecies } from '../core/models';
import { GardenScene, PlantIcon } from '../ui/GardenScene';

const Banner = ({ text }: { text: string }) => {
  const c = useColors();

  return (
    <View
      style={{
        backgroundColor: c.purpleLight,
        borderRadius: 14,
        padding: 14,
        marginBottom: 12,
      }}
    >
      <Text style={{ color: c.purple, fontWeight: '600' }}>
        {text}
      </Text>
    </View>
  );
};

function Breakdown({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const percentage = total
    ? Math.min(100, Math.max(0, (value / total) * 100))
    : 0;

  return (
    <View>
      <Row style={{ justifyContent: 'space-between' }}>
        <T>{label}</T>
        <T kind="label" style={{ fontSize: 16 }}>
          {value} / {total}
        </T>
      </Row>

      <View
        style={{
          height: 8,
          marginTop: 8,
          borderRadius: 4,
          backgroundColor: color + '26',
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            height: 8,
            width: `${percentage}%`,
            backgroundColor: color,
          }}
        />
      </View>
    </View>
  );
}

function formatMinutes(minutes: number) {
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
    : `${minutes}m`;
}

export function ProgressScreen({
  onBack,
  onGarden,
}: {
  onBack: () => void;
  onGarden: () => void;
}) {
  const c = useColors();

  const tasks = useCollection('tasks');
  const notes = useCollection('notes');
  const cards = useCollection('cards');
  const decks = useCollection('decks');
  const sessions = useCollection('sessions');
  const flowers = useCollection('flowers');

  const [month, setMonth] = useState(() => {
    const today = new Date();

    return `${today.getFullYear()}-${String(
      today.getMonth() + 1
    ).padStart(2, '0')}`;
  });

  const validMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(month);

  const modules = moduleAnalytics(
    decks,
    cards,
    sessions,
    month,
    tzOffset()
  );

  const selectedMonthMinutes = modules.reduce(
    (sum, module) => sum + module.minutes,
    0
  );

  const done = useMemo(
    () => sessions.filter(session => session.completed),
    [sessions]
  );

  const total = done.reduce(
    (sum, session) => sum + session.actualMinutes,
    0
  );

  const now = new Date();
  const streak = currentStreak(
    sessions,
    now.getTime(),
    tzOffset()
  );

  const weekStartDate = new Date(now);
  weekStartDate.setHours(0, 0, 0, 0);
  weekStartDate.setDate(
    weekStartDate.getDate() -
      ((weekStartDate.getDay() + 6) % 7)
  );

  const weekStart = weekStartDate.getTime();

  const weekly = useMemo(() => {
    const values = [0, 0, 0, 0, 0, 0, 0];

    const weekEndDate = new Date(weekStart);
    weekEndDate.setDate(weekEndDate.getDate() + 7);
    const weekEnd = weekEndDate.getTime();

    for (const session of done) {
      if (
        session.startedAtMs >= weekStart &&
        session.startedAtMs < weekEnd
      ) {
        const date = new Date(session.startedAtMs);
        const index = (date.getDay() + 6) % 7;
        values[index] += session.actualMinutes;
      }
    }

    return values;
  }, [done, weekStart]);

  const maxV = Math.max(1, ...weekly);
  const todayIdx = (now.getDay() + 6) % 7;

  const months = monthlyMinutes(
    sessions,
    tzOffset()
  ).slice(-6);

  const mmax = Math.max(
    60,
    ...months.map(item => item.minutes)
  );

  const tDone = tasks.filter(task => task.completed).length;
  const mastered = cards.filter(card => card.mastered).length;

  return (
    <Screen>
      <BackableHeader
        title="Your Progress"
        subtitle="Small steps become strong habits"
        onBack={onBack}
      />

      <View style={{ height: 16 }} />

      {tasks.length > 0 && tDone === tasks.length && (
        <Banner text="All tasks completed! 🎉" />
      )}

      {cards.length > 0 && mastered === cards.length && (
        <Banner text="You've mastered every flashcard! 🏆" />
      )}

      <Row style={{ gap: 12, alignItems: 'stretch' }}>
        <View
          style={{
            flex: 1,
            backgroundColor: c.purple,
            borderRadius: 18,
            padding: 18,
          }}
        >
          <Row>
            <Text
              style={{
                color: '#fff',
                fontSize: 30,
                fontWeight: '800',
              }}
            >
              {streak}
            </Text>

            <Text style={{ fontSize: 20 }}> 🔥</Text>
          </Row>

          <Text
            style={{
              color: 'rgba(255,255,255,0.9)',
              fontSize: 13,
            }}
          >
            day streak
          </Text>
        </View>

        <Panel
          radius={18}
          style={{ flex: 1, padding: 18 }}
        >
          <Text
            style={{
              fontSize: 24,
              fontWeight: '800',
              color: c.text,
            }}
          >
            {formatMinutes(total)}
          </Text>

          <T kind="bodyDim">focus time</T>
        </Panel>
      </Row>

      <View style={{ height: 24 }} />

      <T kind="titleLarge">This week</T>

      <View style={{ height: 10 }} />

      <Panel radius={18} style={{ padding: 20 }}>
        <Row
          style={{
            height: 160,
            alignItems: 'flex-end',
            justifyContent: 'space-around',
          }}
        >
          {weekly.map((value, index) => (
            <View
              key={index}
              style={{ alignItems: 'center' }}
            >
              <View
                style={{
                  width: 20,
                  height: Math.max(
                    6,
                    120 * (value / maxV)
                  ),
                  borderRadius: 6,
                  backgroundColor:
                    index === todayIdx
                      ? c.purple
                      : c.purpleLight,
                }}
              />

              <T
                kind="bodyDim"
                style={{ marginTop: 6 }}
              >
                {'MTWTFSS'[index]}
              </T>
            </View>
          ))}
        </Row>
      </Panel>

      <View style={{ height: 24 }} />

      <T kind="titleLarge">Study breakdown</T>

      <View style={{ height: 12 }} />

      <Breakdown
        label="Tasks completed"
        value={tDone}
        total={tasks.length}
        color={c.purple}
      />

      <View style={{ height: 16 }} />

      <Breakdown
        label="Flashcards mastered"
        value={mastered}
        total={cards.length}
        color={c.blue}
      />

      <View style={{ height: 16 }} />

      <Row style={{ justifyContent: 'space-between' }}>
        <T>Notes created</T>
        <T kind="label" style={{ fontSize: 16 }}>
          {notes.length}
        </T>
      </Row>

      <View style={{ height: 8 }} />

      <Row style={{ justifyContent: 'space-between' }}>
        <T>Flowers grown</T>

        <T
          kind="label"
          style={{ fontSize: 16, color: c.purple }}
        >
          {summarize(flowers).total} 🌷
        </T>
      </Row>

      <View style={{ height: 12 }} />

      <Panel
        onPress={onGarden}
        style={{ padding: 14 }}
      >
        <T kind="label" style={{ color: c.purple }}>
          Open my garden →
        </T>
      </Panel>

      <View style={{ height: 24 }} />

      {/* New monthly and per-module analytics */}
      <T kind="titleLarge">
        Focus and mastery by module
      </T>

      <View style={{ height: 12 }} />

      <OutlinedField
        label="Month (YYYY-MM)"
        placeholder="2026-11"
        value={month}
        onChangeText={setMonth}
        maxLength={7}
        autoCorrect={false}
      />

      <View style={{ height: 10 }} />

      {!validMonth ? (
        <T kind="bodyDim">
          Enter a valid month, for example 2026-11.
        </T>
      ) : (
        <>
          <Panel
            radius={16}
            style={{
              padding: 16,
              backgroundColor: c.purpleLight,
            }}
          >
            <T kind="label" style={{ color: c.purple }}>
              Focus in {month}
            </T>

            <Text
              style={{
                fontSize: 26,
                fontWeight: '800',
                color: c.purple,
                marginTop: 6,
              }}
            >
              {formatMinutes(selectedMonthMinutes)}
            </Text>
          </Panel>

          <View style={{ height: 10 }} />

          <T kind="bodyDim">
            Focus time uses the selected month. Mastery
            shows your current flashcard progress.
          </T>

          {decks.length === 0 && (
            <T kind="bodyDim" style={{ marginTop: 10 }}>
              Create a flashcard module to see its mastery
              breakdown here.
            </T>
          )}

          {modules.map(module => {
            const percentage = module.total
              ? Math.round(
                  (module.mastered / module.total) * 100
                )
              : 0;

            return (
              <Panel
                key={module.id || 'general'}
                radius={16}
                style={{
                  padding: 16,
                  marginTop: 12,
                }}
              >
                <T kind="label">{module.name}</T>

                <View style={{ height: 8 }} />

                <T kind="bodyDim">
                  Focus time: {formatMinutes(module.minutes)}
                </T>

                {module.id ? (
                  <>
                    <View style={{ height: 12 }} />

                    <Breakdown
                      label={`Mastery (${percentage}%)`}
                      value={module.mastered}
                      total={module.total}
                      color={c.blue}
                    />
                  </>
                ) : (
                  <>
                    <View style={{ height: 6 }} />

                    <T kind="bodyDim">
                      Sessions without an assigned module,
                      including sessions from removed modules.
                    </T>
                  </>
                )}
              </Panel>
            );
          })}
        </>
      )}

      <View style={{ height: 24 }} />

      {/* Existing monthly totals chart */}
      <T kind="titleLarge">Monthly focus</T>

      <View style={{ height: 10 }} />

      <Panel
        radius={18}
        style={{ padding: 18, gap: 10 }}
      >
        {months.length === 0 && (
          <T kind="bodyDim">
            Complete a focus session to see monthly totals.
          </T>
        )}

        {months.map(item => (
          <Row key={item.month} style={{ gap: 10 }}>
            <T kind="bodyDim" style={{ width: 66 }}>
              {item.month}
            </T>

            <View
              style={{
                flex: 1,
                height: 10,
                borderRadius: 5,
                backgroundColor: c.blue + '26',
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  height: 10,
                  width: `${
                    item.minutes > 0
                      ? Math.max(
                          3,
                          (item.minutes / mmax) * 100
                        )
                      : 0
                  }%`,
                  backgroundColor: c.blue,
                }}
              />
            </View>

            <T
              kind="label"
              style={{
                width: 70,
                textAlign: 'right',
              }}
            >
              {formatMinutes(item.minutes)}
            </T>
          </Row>
        ))}
      </Panel>
    </Screen>
  );
}


const SPECIES_LABEL: Array<{
  species: FlowerSpecies;
  name: string;
  how: string;
}> = [
  {
    species: 'daisy',
    name: 'Daisy',
    how: 'Focus 1–24 min',
  },
  {
    species: 'tulip',
    name: 'Tulip',
    how: 'Focus 25–49 min',
  },
  {
    species: 'sunflower',
    name: 'Sunflower',
    how: 'Focus 50+ min',
  },
  {
    species: 'poppy',
    name: 'Poppy',
    how: 'Low-priority task',
  },
  {
    species: 'rose',
    name: 'Rose',
    how: 'Medium task',
  },
  {
    species: 'lotus',
    name: 'Lotus',
    how: 'High-priority task',
  },
];

export function GardenScreen({
  onBack,
}: {
  onBack: () => void;
}) {
  const c = useColors();
  const { width } = useWindowDimensions();

  const all = useCollection('flowers');
  const [selectedDate, setSelectedDate] = useState('');

  const dateFilter = selectedDate.trim();

  // Validate the format and the actual calendar date.
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(dateFilter)
    ? new Date(`${dateFilter}T00:00:00Z`)
    : null;

  const validDate =
    dateFilter === '' ||
    (
      parsedDate !== null &&
      Number.isFinite(parsedDate.getTime()) &&
      parsedDate.toISOString().slice(0, 10) === dateFilter
    );

  const flowers = layout(
    all.filter(flower =>
      dateFilter === ''
        ? true
        : validDate && flower.dayKey === dateFilter
    )
  );

  const summary = summarize(flowers);

  const availableDates = [...new Set(
    all.map(flower => flower.dayKey)
  )]
    .sort()
    .reverse();

  const sceneW = Math.min(width - 40, 560);

  return (
    <Screen>
      <BackableHeader
        title="My Garden"
        subtitle="Your flowers, organised by date"
        onBack={onBack}
      />

      <View style={{ height: 16 }} />

      <OutlinedField
        label="Filter by date (YYYY-MM-DD)"
        placeholder="2026-11-08"
        value={selectedDate}
        onChangeText={setSelectedDate}
        maxLength={10}
        autoCorrect={false}
      />

      <View style={{ height: 8 }} />

      <T kind="bodyDim">
        Type a date, tap a date below, or choose All dates.
      </T>

      {!validDate && (
        <T
          kind="bodyDim"
          style={{ color: c.danger, marginTop: 8 }}
        >
          Enter a valid date in YYYY-MM-DD format.
        </T>
      )}

      <Row
        style={{
          gap: 8,
          flexWrap: 'wrap',
          marginTop: 12,
        }}
      >
        <Panel
          onPress={() => setSelectedDate('')}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 10,
            backgroundColor:
              dateFilter === ''
                ? c.purpleLight
                : c.surface,
          }}
        >
          <T kind="label" style={{ color: c.purple }}>
            {dateFilter === '' ? '✓ ' : ''}All dates
          </T>
        </Panel>

        {availableDates.slice(0, 14).map(date => (
          <Panel
            key={date}
            onPress={() => setSelectedDate(date)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 10,
              backgroundColor:
                dateFilter === date
                  ? c.purpleLight
                  : c.surface,
            }}
          >
            <T kind="label" style={{ color: c.purple }}>
              {dateFilter === date ? '✓ ' : ''}
              {date}
            </T>
          </Panel>
        ))}
      </Row>

      <View style={{ height: 16 }} />

      <View
        style={{
          backgroundColor: c.purple,
          borderRadius: 20,
          padding: 20,
        }}
      >
        <Text
          style={{
            color: 'rgba(255,255,255,0.8)',
            fontSize: 12,
            fontWeight: '600',
          }}
        >
          {dateFilter === ''
            ? 'YOUR ENTIRE GARDEN'
            : validDate
              ? `FLOWERS FROM ${dateFilter}`
              : 'CHOOSE A VALID DATE'}
        </Text>

        <Text
          style={{
            color: '#fff',
            fontSize: 32,
            fontWeight: '800',
            marginTop: 4,
          }}
        >
          {summary.total} flower
          {summary.total === 1 ? '' : 's'}
        </Text>

        <Text
          style={{
            color: 'rgba(255,255,255,0.85)',
            fontSize: 14,
          }}
        >
          {summary.fromFocus} from focus sessions ·{' '}
          {summary.fromTasks} from tasks
        </Text>
      </View>

      <View style={{ height: 16 }} />

      <View
        style={{
          borderRadius: 20,
          overflow: 'hidden',
          alignSelf: 'center',
        }}
      >
        <GardenScene
          flowers={flowers}
          width={sceneW}
        />
      </View>

      {validDate && flowers.length === 0 && (
        <T
          kind="bodyDim"
          style={{
            textAlign: 'center',
            marginTop: 10,
          }}
        >
          {dateFilter
            ? 'No flowers were planted on this date. Choose another date or All dates.'
            : 'Finish a focus session or complete a task to plant your first flower.'}
        </T>
      )}

      <View style={{ height: 20 }} />

      <T kind="titleLarge">How flowers grow</T>

      <View style={{ height: 10 }} />

      <Panel style={{ padding: 14 }}>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            rowGap: 12,
          }}
        >
          {SPECIES_LABEL.map(species => (
            <View
              key={species.species}
              style={{
                width: '33.3%',
                alignItems: 'center',
              }}
            >
              <PlantIcon
                species={species.species}
                size={38}
              />

              <Text
                style={{
                  fontWeight: '600',
                  color: c.text,
                  fontSize: 13,
                }}
              >
                {species.name} ·{' '}
                {summary.bySpecies[species.species] ?? 0}
              </Text>

              <T
                kind="labelDim"
                style={{
                  fontSize: 10,
                  textAlign: 'center',
                }}
              >
                {species.how}
              </T>
            </View>
          ))}
        </View>
      </Panel>

      <View style={{ height: 10 }} />

      <Panel style={{ padding: 16, gap: 8 }}>
        <T kind="bodyDim">
          Complete a focus session of at least 1 minute
          to plant a flower. Longer sessions grow different
          flowers. Stopping or resetting early grows nothing.
        </T>

        <T kind="bodyDim">
          Each task earns one flower, up to{' '}
          {MAX_TASK_FLOWERS_PER_DAY} task flowers per day.
        </T>

        <T kind="bodyDim">
          The date filter changes only what you see.
          Your other flowers stay saved.
        </T>
      </Panel>
    </Screen>
  );
}