package server

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
)

// ResourceLister determines the list of resources of a particular kind
type ResourceLister struct {
	BearerToken string
	RequestURL  *url.URL
	Client      *http.Client
}

func (l *ResourceLister) handleResources(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		sendResponse(w, http.StatusMethodNotAllowed, apiError{"invalid method: only GET is allowed"})
		return
	}

	req, err := http.NewRequest("GET", l.RequestURL.String(), nil)
	if err != nil {
		sendResponse(w, http.StatusInternalServerError, apiError{fmt.Sprintf("failed to create GET request: %v", err)})
		return
	}

	req.Header.Set("Authorization", "Bearer "+l.BearerToken)
	resp, err := l.Client.Do(req)
	if err != nil {
		sendResponse(w, http.StatusBadGateway, apiError{fmt.Sprintf("GET request failed: %v", err)})
		return
	}

	if resp.StatusCode != http.StatusOK {
		err := fmt.Errorf("console service account cannot list resource: %s", resp.Status)
		sendResponse(w, http.StatusInternalServerError, apiError{err.Error()})
		return
	}

	w.WriteHeader(resp.StatusCode)
	io.Copy(w, resp.Body)
	resp.Body.Close()
}
