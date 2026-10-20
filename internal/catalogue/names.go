// Package catalogue defines the formats shared by the quick CLI and the
// catalogue maintenance tool: app names, the app index, the runtime lock and
// the rules app source must follow.
package catalogue

import (
	"fmt"
	"regexp"
	"slices"
	"strings"
)

var (
	namePattern   = regexp.MustCompile(`^[a-z0-9][a-z0-9-]*$`)
	sha256Pattern = regexp.MustCompile(`^[0-9a-f]{64}$`)
)

// Reserved lists the CLI's subcommands. An app with one of these names could
// never be run, so the maintenance tool refuses to index one.
var Reserved = []string{"help", "version", "list", "info", "update", "clean"}

// ValidateName reports whether name is usable as an app name. Names are
// restricted to lowercase letters, digits and hyphens so that they can never
// be interpreted as a path or a command-line option.
func ValidateName(name string) error {
	if !namePattern.MatchString(name) {
		return fmt.Errorf("invalid app name %q (lowercase letters, digits and hyphens only)", name)
	}
	return nil
}

// ValidateNewName applies ValidateName and also rejects reserved names.
func ValidateNewName(name string) error {
	if err := ValidateName(name); err != nil {
		return err
	}
	if slices.Contains(Reserved, name) {
		return fmt.Errorf("app name %q is reserved by quick", name)
	}
	return nil
}

func validSHA256(s string) bool {
	return sha256Pattern.MatchString(s)
}

// Normalize returns the form of name used for matching. Two names with the
// same normal form are the same app as far as lookup is concerned.
func Normalize(name string) string {
	return strings.ReplaceAll(name, "-", "")
}
