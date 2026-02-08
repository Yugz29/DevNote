from django.shortcuts import render

def index(request):
    """Serves the frontend home page"""
    return render(request, 'index.html')
