package main

import "testing"

func TestParseChecksumFile(t *testing.T) {
	const want = "c4c4ac8bfdaa37814bda5c05fc9cdf2154904e2ef827767" + "3a30bdceaaa649807"
	cases := map[string]string{
		"unix":       want + "  deno-aarch64-apple-darwin.zip\n",
		"powershell": "\r\nAlgorithm : SHA256\r\nHash      : C4C4AC8BFDAA37814BDA5C05FC9CDF2154904E2EF8277673A30BDCEAAA649807\r\nPath      : C:\\a\\deno\\deno.zip\r\n",
	}
	for name, body := range cases {
		got, err := parseChecksumFile([]byte(body))
		if err != nil || got != want {
			t.Errorf("%s: got %q, %v; want %q", name, got, err, want)
		}
	}
	for name, body := range map[string]string{
		"empty": "",
		"short": "abc123  deno.zip\n",
		"two":   want + "\n" + want + "\n",
	} {
		if _, err := parseChecksumFile([]byte(body)); err == nil {
			t.Errorf("%s: parseChecksumFile succeeded, want error", name)
		}
	}
}
