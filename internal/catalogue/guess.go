package catalogue

import (
	"slices"
	"strings"
)

// Guess finds the app a mistyped name most likely meant. It returns match
// when exactly one app is close enough to run without asking, and otherwise
// up to three names worth suggesting.
//
// Running a guess is only safe because every app is reviewed and sandboxed,
// so the worst outcome is the wrong harmless app. The limits keep that rare:
// short names are never corrected, because one edit turns most short words
// into other short words, and a tie between two apps is never broken.
func (ix *Index) Guess(name string) (match *Entry, suggestions []string) {
	typed := Normalize(name)
	type scored struct {
		entry    int
		name     string
		distance int
	}
	var best []scored // closest name per app
	for i, e := range ix.entries {
		s := scored{entry: i, distance: -1}
		for _, n := range e.Names() {
			if d := editDistance(typed, Normalize(n)); s.distance < 0 || d < s.distance {
				s.name, s.distance = n, d
			}
		}
		best = append(best, s)
	}
	slices.SortStableFunc(best, func(a, b scored) int { return a.distance - b.distance })

	if len(best) > 0 && best[0].distance <= autoCorrectLimit(len(typed)) &&
		(len(best) == 1 || best[1].distance > best[0].distance) {
		e := ix.entries[best[0].entry]
		return &e, nil
	}
	for _, s := range best {
		if s.distance <= max(2, len(typed)/3) && len(suggestions) < 3 {
			suggestions = append(suggestions, s.name)
		}
	}
	return nil, suggestions
}

// autoCorrectLimit is the most edits a typed name of length n may be from an
// app's name and still run it without asking.
func autoCorrectLimit(n int) int {
	switch {
	case n < 6:
		return 0
	case n < 12:
		return 1
	default:
		return 2
	}
}

// editDistance counts the insertions, deletions, substitutions and swaps of
// adjacent letters needed to turn a into b. Swaps count once because they
// are the most common typing slip.
func editDistance(a, b string) int {
	ra, rb := []rune(strings.ToLower(a)), []rune(strings.ToLower(b))
	prev2 := make([]int, len(rb)+1)
	prev := make([]int, len(rb)+1)
	cur := make([]int, len(rb)+1)
	for j := range prev {
		prev[j] = j
	}
	for i := 1; i <= len(ra); i++ {
		cur[0] = i
		for j := 1; j <= len(rb); j++ {
			cost := 1
			if ra[i-1] == rb[j-1] {
				cost = 0
			}
			cur[j] = min(prev[j]+1, cur[j-1]+1, prev[j-1]+cost)
			if i > 1 && j > 1 && ra[i-1] == rb[j-2] && ra[i-2] == rb[j-1] {
				cur[j] = min(cur[j], prev2[j-2]+1)
			}
		}
		prev2, prev, cur = prev, cur, prev2
	}
	return prev[len(rb)]
}
