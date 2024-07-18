package main

import (
	"net/http"
	"os/exec"
)

func main() {
	http.ListenAndServe(":8002", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cmd := exec.Command("cat", "main.c")
		b, err := cmd.CombinedOutput()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Write(b)
	}))
}
